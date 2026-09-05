const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const session = require("express-session");
const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = 3000;

// =====================================================
// BASE DE DATOS
// =====================================================
const db = new Database("ocris.db");

// =====================================================
// CARPETA DE FOTOGRAFÍAS
// =====================================================
const carpetaFotos = path.join(__dirname, "public", "uploads", "mantenimientos");

if (!fs.existsSync(carpetaFotos)) {
    fs.mkdirSync(carpetaFotos, { recursive: true });
}

// =====================================================
// CONFIGURACIÓN DE MULTER (MÁXIMO 4 FOTOS)
// =====================================================
const almacenamientoFotos = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, carpetaFotos);
    },
    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname).toLowerCase();
        const nombre = `foto-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${extension}`;
        cb(null, nombre);
    }
});

const subirFotos = multer({
    storage: almacenamientoFotos,
    limits: {
        files: 4, // <-- Ajustado a 4 fotos para sincronizar con el frontend
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
        const tiposPermitidos = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
        if (tiposPermitidos.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Solo se permiten fotografías."));
        }
    }
});

// =====================================================
// FUNCIONES DE CONTRASEÑA Y LOGS
// =====================================================
function crearHash(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return `${salt}:${hash}`;
}

function comprobarPassword(password, almacenada) {
    const partes = almacenada.split(":");
    if (partes.length !== 2) return false;
    const salt = partes[0];
    const hashOriginal = partes[1];
    const hashCalculado = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hashOriginal, "hex"), Buffer.from(hashCalculado, "hex"));
}

// Función centralizada para registrar auditorías
function registrarLog(usuario, accion, mantenimiento_id, detalles) {
    try {
        db.prepare(`
            INSERT INTO logs_auditoria (usuario, accion, mantenimiento_id, detalles) 
            VALUES (?, ?, ?, ?)
        `).run(usuario || 'Sistema', accion, mantenimiento_id, detalles);
    } catch (err) {
        console.error("❌ Error al registrar log de auditoría:", err.message);
    }
}

// =====================================================
// TABLAS
// =====================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS mantenimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        estructura TEXT,
        ubicacion TEXT,
        tipo_mantenimiento TEXT,
        elemento TEXT,
        descripcion TEXT,
        observaciones TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS estructuras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT NOT NULL UNIQUE,
        tipo TEXT NOT NULL,
        ubicacion TEXT,
        estado TEXT,
        latitud TEXT,
        longitud TEXT,
        observaciones TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        password TEXT NOT NULL,
        rol TEXT DEFAULT 'Tecnico',
        activo INTEGER DEFAULT 1,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS logs_auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT NOT NULL,
        accion TEXT NOT NULL,
        mantenimiento_id INTEGER,
        fecha TEXT DEFAULT CURRENT_TIMESTAMP,
        detalles TEXT
    );
`);

// =====================================================
// AGREGAR CAMPOS A TABLAS (Manejo dinámico)
// =====================================================
const columnasEquipos = [
    ["marca", "TEXT"], ["modelo", "TEXT"], ["numero_serie", "TEXT"], ["fecha_instalacion", "TEXT"]
];
for (const [columna, tipo] of columnasEquipos) {
    try { db.prepare(`ALTER TABLE estructuras ADD COLUMN ${columna} ${tipo}`).run(); } catch (error) {}
}

const columnasMantenimiento = [
    ["realizado_por", "TEXT"], ["tiene_pendiente", "TEXT DEFAULT 'No'"],
    ["pendiente", "TEXT"], ["latitud", "TEXT"], ["longitud", "TEXT"], ["fotos", "TEXT"]
];
for (const [columna, tipo] of columnasMantenimiento) {
    try { db.prepare(`ALTER TABLE mantenimientos ADD COLUMN ${columna} ${tipo}`).run(); } catch (error) {}
}

// =====================================================
// CREAR USUARIO ADMINISTRADOR INICIAL
// =====================================================
const cantidadUsuarios = db.prepare(`SELECT COUNT(*) AS total FROM usuarios`).get();
if (cantidadUsuarios.total === 0) {
    const passwordHash = crearHash("admin123");
    db.prepare(`
        INSERT INTO usuarios (usuario, nombre, password, rol, activo) VALUES (?, ?, ?, ?, ?)
    `).run("admin", "Administrador", passwordHash, "Administrador", 1);
    console.log("\n================================");
    console.log(" USUARIO ADMINISTRADOR CREADO");
    console.log("================================");
    console.log("Usuario: admin\nContraseña: admin123");
    console.log("================================\n");
}

// =====================================================
// CONFIGURACIÓN EXPRESS Y SESIONES
// =====================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "20mb" }));

app.use(session({
    secret: "OCRIS-LOCAL-2026-SECRET-CAMBIAR",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 }
}));

// =====================================================
// LOGIN Y RUTAS PÚBLICAS
// =====================================================
app.get("/login.html", (req, res) => {
    if (req.session.usuario) return res.redirect("/");
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/api/login", (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ ok: false, mensaje: "Ingrese usuario y contraseña" });

    const usuarioDB = db.prepare(`SELECT * FROM usuarios WHERE usuario = ? AND activo = 1`).get(usuario);
    if (!usuarioDB || !comprobarPassword(password, usuarioDB.password)) {
        return res.status(401).json({ ok: false, mensaje: "Usuario o contraseña incorrectos" });
    }

    req.session.usuario = {
        id: usuarioDB.id, usuario: usuarioDB.usuario, nombre: usuarioDB.nombre, rol: usuarioDB.rol
    };

    req.session.save((err) => {
        if (err) return res.status(500).json({ ok: false, mensaje: "Error interno al guardar sesión" });
        
        // Registrar ingreso en auditoría
        registrarLog(usuarioDB.usuario, "LOGIN", null, "Inicio de sesión en el sistema");
        res.json({ ok: true, mensaje: "Inicio de sesión correcto" });
    });
});

app.post("/api/logout", (req, res) => {
    const usr = req.session.usuario ? req.session.usuario.usuario : "Desconocido";
    req.session.destroy(() => {
        registrarLog(usr, "LOGOUT", null, "Cierre de sesión");
        res.json({ ok: true });
    });
});

app.get("/api/usuario", (req, res) => {
    if (!req.session.usuario) return res.status(401).json({ ok: false });
    res.json({ ok: true, usuario: req.session.usuario });
});

// =====================================================
// MIDDLEWARES DE AUTENTICACIÓN
// =====================================================
function requiereLogin(req, res, next) {
    if (req.session.usuario) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ ok: false, mensaje: "Debe iniciar sesión" });
    return res.redirect("/login.html");
}

function requiereAdmin(req, res, next) {
    if (req.session.usuario && req.session.usuario.rol === 'Administrador') return next();
    if (req.path.startsWith("/api/")) return res.status(403).json({ ok: false, mensaje: "Acceso denegado. Se requieren permisos de Administrador." });
    return res.redirect("/login.html");
}

app.use((req, res, next) => {
    if (req.path === "/login.html" || req.path === "/api/login" || req.path.startsWith("/css/") || req.path.startsWith("/js/") || req.path.startsWith("/img/") || req.path.startsWith("/assets/")) {
        return next();
    }
    requiereLogin(req, res, next);
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });

// =====================================================
// MANTENIMIENTOS
// =====================================================

// GUARDAR (POST)
app.post("/api/mantenimientos", subirFotos.array("fotografias", 4), (req, res) => {
    const { fecha, estructura, ubicacion, tipo_mantenimiento, elemento, descripcion, observaciones, tiene_pendiente, pendiente, latitud, longitud } = req.body;
    const usuarioActual = req.session.usuario;
    if (!usuarioActual) return res.status(401).json({ ok: false, mensaje: "Debe iniciar sesión" });

    const valorPend = String(tiene_pendiente || "No").trim().toUpperCase();
    const pendienteExiste = (valorPend === "SÍ" || valorPend === "SI");
    let pendienteFinal = null;

    if (pendienteExiste) {
        pendienteFinal = String(pendiente || "").trim();
        if (!pendienteFinal) return res.status(400).json({ ok: false, mensaje: "Debe indicar cuál es el pendiente." });
    }

    const fotos = (req.files || []).map(archivo => archivo.filename);
    const fotosJSON = JSON.stringify(fotos);

    try {
        const resultado = db.prepare(`
            INSERT INTO mantenimientos (fecha, estructura, ubicacion, tipo_mantenimiento, elemento, descripcion, observaciones, realizado_por, tiene_pendiente, pendiente, latitud, longitud, fotos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(fecha, estructura, ubicacion, tipo_mantenimiento, elemento, descripcion, observaciones, usuarioActual.usuario, pendienteExiste ? "Sí" : "No", pendienteFinal, latitud || null, longitud || null, fotosJSON);

        // LOG DE AUDITORÍA (Creación)
        registrarLog(usuarioActual.usuario, 'CREACION', resultado.lastInsertRowid, `Registró un nuevo mantenimiento tipo ${tipo_mantenimiento}`);

        res.json({ ok: true, mensaje: "Mantenimiento guardado correctamente", id: resultado.lastInsertRowid, pendiente: pendienteExiste, fotos: fotos.length });
    } catch (error) {
        console.error("Error guardando mantenimiento:", error);
        (req.files || []).forEach(archivo => { try { fs.unlinkSync(archivo.path); } catch (e) {} });
        res.status(500).json({ ok: false, mensaje: "No se pudo guardar el mantenimiento" });
    }
});

// OBTENER TODOS (GET)
app.get("/api/mantenimientos", (req, res) => {
    try {
        const mantenimientos = db.prepare(`SELECT * FROM mantenimientos ORDER BY id DESC`).all();
        const resultado = mantenimientos.map(m => {
            let fotos = [];
            try { fotos = JSON.parse(m.fotos || "[]"); } catch (error) {}
            return { ...m, fotos };
        });
        res.json(resultado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "No se pudieron obtener los mantenimientos" });
    }
});

// OBTENER UNO (GET)
app.get("/api/mantenimientos/:id", (req, res) => {
    try {
        const mantenimiento = db.prepare(`SELECT * FROM mantenimientos WHERE id = ?`).get(req.params.id);
        if (!mantenimiento) return res.status(404).json({ ok: false, mensaje: "Mantenimiento no encontrado" });

        let fotos = [];
        try { fotos = JSON.parse(mantenimiento.fotos || "[]"); } catch (error) {}
        res.json({ ok: true, mantenimiento: { ...mantenimiento, fotos } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, mensaje: "No se pudo obtener el mantenimiento" });
    }
});

// =====================================================
// EDITAR MANTENIMIENTO (TÉCNICOS Y ADMINS)
// =====================================================
app.put("/api/mantenimientos/:id", subirFotos.array("fotografias", 4), (req, res) => {
    // Nota: Eliminamos requiereAdmin para que los técnicos puedan entrar a esta ruta
    const id = req.params.id;
    const { fecha, estructura, ubicacion, tipo_mantenimiento, elemento, descripcion, observaciones, tiene_pendiente, pendiente, fotosRestantes } = req.body;
    const usuarioActual = req.session.usuario.usuario;

    const valorPend = String(tiene_pendiente || "No").trim().toUpperCase();
    const pendienteExiste = (valorPend === "SÍ" || valorPend === "SI");
    const pendienteFinal = pendienteExiste ? String(pendiente || "").trim() : null;

    try {
        const mantActual = db.prepare(`SELECT fotos FROM mantenimientos WHERE id = ?`).get(id);
        if (!mantActual) return res.status(404).json({ ok: false, mensaje: "No encontrado" });
        
        let fotosViejas = [];
        try { fotosViejas = JSON.parse(mantActual.fotos || "[]"); } catch (e) {}

        let fotosQueSeQuedan = fotosViejas;
        if (fotosRestantes) { try { fotosQueSeQuedan = JSON.parse(fotosRestantes); } catch (e) {} }

        const fotosParaBorrar = fotosViejas.filter(f => !fotosQueSeQuedan.includes(f));
        fotosParaBorrar.forEach(nombreFoto => {
            const rutaFoto = path.join(carpetaFotos, nombreFoto);
            if (fs.existsSync(rutaFoto)) { try { fs.unlinkSync(rutaFoto); } catch(e){} }
        });

        const fotosNuevas = (req.files || []).map(archivo => archivo.filename);
        const fotosTotales = [...fotosQueSeQuedan, ...fotosNuevas];
        const fotosJSON = JSON.stringify(fotosTotales);

        db.prepare(`
            UPDATE mantenimientos 
            SET fecha = ?, estructura = ?, ubicacion = ?, tipo_mantenimiento = ?, elemento = ?, descripcion = ?, observaciones = ?, tiene_pendiente = ?, pendiente = ?, fotos = ?
            WHERE id = ?
        `).run(fecha, estructura, ubicacion, tipo_mantenimiento, elemento, descripcion, observaciones, pendienteExiste ? "Sí" : "No", pendienteFinal, fotosJSON, id);

        // LOG DE AUDITORÍA (Edición)
        registrarLog(usuarioActual, 'EDICION', id, `Editó el registro. Se añadieron ${fotosNuevas.length} fotos y eliminaron ${fotosParaBorrar.length}.`);

        res.json({ ok: true, mensaje: "Mantenimiento actualizado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, mensaje: "Error al actualizar" });
    }
});

// =====================================================
// ELIMINAR MANTENIMIENTO (SOLO ADMINS)
// =====================================================
app.delete("/api/mantenimientos/:id", requiereAdmin, (req, res) => {
    // Nota: Mantenemos requiereAdmin aquí para proteger la eliminación
    const id = req.params.id;
    const usuarioActual = req.session.usuario.usuario;

    try {
        const mantenimiento = db.prepare(`SELECT fotos FROM mantenimientos WHERE id = ?`).get(id);
        if (!mantenimiento) return res.status(404).json({ ok: false, mensaje: "Mantenimiento no encontrado" });

        if (mantenimiento.fotos) {
            try {
                const fotos = JSON.parse(mantenimiento.fotos);
                fotos.forEach(nombreFoto => {
                    const rutaFoto = path.join(carpetaFotos, nombreFoto);
                    if (fs.existsSync(rutaFoto)) fs.unlinkSync(rutaFoto);
                });
            } catch (err) {}
        }

        db.prepare(`DELETE FROM mantenimientos WHERE id = ?`).run(id);

        // LOG DE AUDITORÍA (Eliminación)
        registrarLog(usuarioActual, 'ELIMINACION', id, `Eliminó el mantenimiento permanentemente del sistema`);

        res.json({ ok: true, mensaje: "Mantenimiento eliminado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, mensaje: "Error al eliminar" });
    }
});

// =====================================================
// GENERAR PDF DEL MANTENIMIENTO
// =====================================================
app.get("/api/mantenimientos/:id/pdf", async (req, res) => {
    try {
        const mantenimiento = db.prepare(`SELECT * FROM mantenimientos WHERE id = ?`).get(req.params.id);
        if (!mantenimiento) return res.status(404).send("Mantenimiento no encontrado");

        let fotos = [];
        try { fotos = JSON.parse(mantenimiento.fotos || "[]"); } catch (error) {}

        let equipo = null;
        if (mantenimiento.estructura) {
            equipo = db.prepare(`SELECT * FROM estructuras WHERE codigo = ?`).get(mantenimiento.estructura);
        }

        const documento = new PDFDocument({
            size: "A4", margin: 45,
            info: { Title: `Informe #${mantenimiento.id}`, Author: "OCRIS", Subject: "Mantenimiento de Equipos" }
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="informe-${mantenimiento.id}.pdf"`);
        documento.pipe(res);

        const rutaLogo = path.join(__dirname, "public", "img", "logo.png");
        if (fs.existsSync(rutaLogo)) documento.image(rutaLogo, 45, 35, { width: 60 });

        documento.fillColor("#0b3d62").fontSize(24).font("Helvetica-Bold").text("OCRIS", { align: "center" });
        documento.fillColor("#334155").fontSize(12).font("Helvetica").text("Mantenimiento de Equipos de Red GOSSR", { align: "center" });
        documento.moveDown();
        documento.moveTo(45, documento.y).lineTo(550, documento.y).strokeColor("#0b3d62").stroke();
        documento.moveDown();

        documento.fillColor("#0b3d62").fontSize(18).font("Helvetica-Bold").text(`INFORME DE MANTENIMIENTO #${mantenimiento.id}`);
        documento.moveDown();

        documento.fillColor("#1f2937").fontSize(11).font("Helvetica");
        function linea(etiqueta, valor) {
            documento.font("Helvetica-Bold").text(`${etiqueta}: `, { continued: true }).font("Helvetica").text(valor || "No registrado");
        }

        linea("Fecha", mantenimiento.fecha);
        linea("Equipo", mantenimiento.estructura);
        linea("Ubicación", mantenimiento.ubicacion);
        linea("Tipo", mantenimiento.tipo_mantenimiento);
        linea("Elemento intervenido", mantenimiento.elemento);
        linea("Realizado por", mantenimiento.realizado_por);
        documento.moveDown();

        if (equipo) {
            documento.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("DATOS DEL EQUIPO");
            documento.moveDown(0.5);
            documento.fillColor("#1f2937").fontSize(10).font("Helvetica");
            linea("Código", equipo.codigo);
            linea("Tipo", equipo.tipo);
            linea("Marca", equipo.marca);
            linea("Modelo", equipo.modelo);
            linea("N. de serie", equipo.numero_serie);
            documento.moveDown();
        }

        documento.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("TRABAJO REALIZADO");
        documento.moveDown(0.5);
        documento.fillColor("#1f2937").fontSize(10).font("Helvetica").text(mantenimiento.descripcion || "Sin descripción");
        documento.moveDown();

        documento.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("OBSERVACIONES");
        documento.moveDown(0.5);
        documento.fillColor("#1f2937").fontSize(10).font("Helvetica").text(mantenimiento.observaciones || "Sin observaciones");
        documento.moveDown();

        const existePendiente = String(mantenimiento.tiene_pendiente || "No").trim() === "Sí";
        if (existePendiente) {
            documento.roundedRect(45, documento.y, 505, 70, 6).fill("#fee2e2");
            documento.fillColor("#991b1b").fontSize(15).font("Helvetica-Bold").text("⚠ PENDIENTE");
            documento.fillColor("#7f1d1d").fontSize(10).font("Helvetica").text(mantenimiento.pendiente || "No especificado");
            documento.moveDown();
        } else {
            documento.fillColor("#166534").fontSize(12).font("Helvetica-Bold").text("✓ MANTENIMIENTO SIN PENDIENTES");
            documento.moveDown();
        }

        if (fotos.length > 0) {
            documento.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("EVIDENCIAS FOTOGRÁFICAS");
            documento.moveDown();
            let posicionY = documento.y;
            let columnaActual = 0; 
            for (let i = 0; i < fotos.length; i++) {
                const rutaFoto = path.join(carpetaFotos, fotos[i]);
                if (fs.existsSync(rutaFoto)) {
                    if (posicionY + 180 > 750) { documento.addPage(); posicionY = 50; columnaActual = 0; }
                    const posicionX = columnaActual === 0 ? 45 : 310;
                    documento.image(rutaFoto, posicionX, posicionY, { fit: [230, 180], align: "center", valign: "center" });
                    
                    if (columnaActual === 0) { columnaActual = 1; } 
                    else { columnaActual = 0; posicionY += 200; documento.y = posicionY; }
                    if (i === fotos.length - 1 && columnaActual === 1) { posicionY += 200; documento.y = posicionY; }
                }
            }
        }

        documento.moveDown();
        documento.fillColor("#64748b").fontSize(9).font("Helvetica").text(`Generado el ${new Date().toLocaleString("es-ES")}`, { align: "center" });
        documento.end();
    } catch (error) {
        console.error("Error PDF:", error);
        if (!res.headersSent) res.status(500).json({ ok: false, mensaje: "Error al generar PDF" });
    }
});

// =====================================================
// CONSULTAR LOGS DE AUDITORÍA (SOLO ADMIN)
// =====================================================
app.get("/api/logs", requiereAdmin, (req, res) => {
    try {
        const logs = db.prepare(`SELECT * FROM logs_auditoria ORDER BY id DESC LIMIT 100`).all();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ ok: false, mensaje: "Error al obtener los logs" });
    }
});

// =====================================================
// EQUIPOS Y USUARIOS (Manteniendo tu código original)
// =====================================================
app.post("/api/estructuras", (req, res) => {
    const { codigo, tipo, marca, modelo, numero_serie, fecha_instalacion, ubicacion, estado, latitud, longitud, observaciones } = req.body;
    try {
        const resultado = db.prepare(`INSERT INTO estructuras (codigo, tipo, marca, modelo, numero_serie, fecha_instalacion, ubicacion, estado, latitud, longitud, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(codigo, tipo, marca, modelo, numero_serie, fecha_instalacion, ubicacion, estado, latitud, longitud, observaciones);
        res.json({ ok: true, mensaje: "Equipo guardado correctamente", id: resultado.lastInsertRowid });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(400).json({ ok: false, mensaje: "El código ya existe" });
        res.status(500).json({ ok: false, mensaje: "Error al guardar el equipo" });
    }
});
// =====================================================
// EDITAR EQUIPO (DISPONIBLE PARA TODOS)
// =====================================================
app.put("/api/estructuras/:id", (req, res) => {
    const { codigo, tipo, marca, modelo, numero_serie, fecha_instalacion, ubicacion, estado, latitud, longitud, observaciones } = req.body;
    try {
        db.prepare(`
            UPDATE estructuras 
            SET codigo = ?, tipo = ?, marca = ?, modelo = ?, numero_serie = ?, fecha_instalacion = ?, ubicacion = ?, estado = ?, latitud = ?, longitud = ?, observaciones = ?
            WHERE id = ?
        `).run(codigo, tipo, marca, modelo, numero_serie, fecha_instalacion, ubicacion, estado, latitud, longitud, observaciones, req.params.id);
        res.json({ ok: true, mensaje: "Equipo actualizado correctamente" });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(400).json({ ok: false, mensaje: "El código ya existe en otro equipo" });
        res.status(500).json({ ok: false, mensaje: "Error al actualizar el equipo" });
    }
});
app.get("/api/estructuras", (req, res) => {
    try { res.json(db.prepare(`SELECT * FROM estructuras ORDER BY id DESC`).all()); } catch (error) { res.status(500).json({ error: "Error al obtener equipos" }); }
});

app.delete("/api/estructuras/:id", requiereAdmin, (req, res) => {
    try {
        const resultado = db.prepare(`DELETE FROM estructuras WHERE id = ?`).run(req.params.id);
        if (resultado.changes === 0) return res.status(404).json({ ok: false, mensaje: "Equipo no encontrado" });
        res.json({ ok: true, mensaje: "Equipo eliminado" });
    } catch (error) { res.status(500).json({ ok: false, mensaje: "Error al eliminar" }); }
});

app.get("/api/usuarios", requiereAdmin, (req, res) => {
    try { res.json(db.prepare(`SELECT id, usuario, nombre, rol, activo, creado_en FROM usuarios ORDER BY id DESC`).all()); } catch (error) { res.status(500).json({ ok: false, mensaje: "Error" }); }
});

app.post("/api/usuarios", requiereAdmin, (req, res) => {
    const { usuario, nombre, password, rol } = req.body;
    if (!usuario || !nombre || !password) return res.status(400).json({ ok: false, mensaje: "Faltan datos." });
    try {
        db.prepare(`INSERT INTO usuarios (usuario, nombre, password, rol, activo) VALUES (?, ?, ?, ?, 1)`).run(usuario, nombre, crearHash(password), rol || "Tecnico");
        res.json({ ok: true, mensaje: "Usuario creado" });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(400).json({ ok: false, mensaje: "Usuario ya existe." });
        res.status(500).json({ ok: false, mensaje: "Error" });
    }
});

app.delete("/api/usuarios/:id", requiereAdmin, (req, res) => {
    if (Number(req.params.id) === Number(req.session.usuario.id)) return res.status(400).json({ ok: false, mensaje: "No puedes eliminarte a ti mismo." });
    try {
        const resultado = db.prepare(`DELETE FROM usuarios WHERE id = ?`).run(req.params.id);
        if (resultado.changes === 0) return res.status(404).json({ ok: false, mensaje: "No encontrado" });
        res.json({ ok: true, mensaje: "Usuario eliminado" });
    } catch (error) { res.status(500).json({ ok: false, mensaje: "Error" }); }
});

// Manejo de errores de Multer
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ ok: false, mensaje: `Error de fotos: ${error.message}` });
    if (error && error.message === "Solo se permiten fotografías.") return res.status(400).json({ ok: false, mensaje: error.message });
    next(error);
});

app.listen(PORT, () => {
    console.log("================================\n             OCRIS\n================================");
    console.log(`Servidor funcionando en: http://localhost:${PORT}\n================================`);
    console.log("✓ Modo Auditoría (Logs automáticos)\n✓ Edición Técnicos\n✓ Límite 4 Fotos\n================================");
});
