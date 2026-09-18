const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const session = require("express-session");
const crypto = require("crypto");
const fs = require("fs");
const multer = require("multer");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 4000;

// =====================================================
// BASE DE DATOS (SQLITE - Persistente)
// =====================================================
const db = new Database("ocris.db");

const carpetaFotos = path.join(__dirname, "public", "uploads", "mantenimientos");
if (!fs.existsSync(carpetaFotos)) { fs.mkdirSync(carpetaFotos, { recursive: true }); }

const almacenamientoFotos = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, carpetaFotos); },
    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname).toLowerCase();
        const nombre = `foto-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${extension}`;
        cb(null, nombre);
    }
});

const subirFotos = multer({
    storage: almacenamientoFotos,
    limits: { files: 4, fileSize: 10 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const tiposPermitidos = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
        if (tiposPermitidos.includes(file.mimetype)) cb(null, true);
        else cb(new Error("Solo se permiten fotografías."));
    }
});

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

function obtenerHoraUTC4() {
    const fecha = new Date();
    fecha.setUTCHours(fecha.getUTCHours() - 4); 
    return fecha.toISOString().replace('T', ' ').substring(0, 19); 
}

function formatoDDMMAAAA(fechaStr) {
    if (!fechaStr) return "";
    const partesEspacio = fechaStr.split(" ");
    const partesFecha = partesEspacio[0].split("-");
    if (partesFecha.length === 3) {
        const fechaFormateada = `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}`;
        return partesEspacio.length > 1 ? `${fechaFormateada} ${partesEspacio[1]}` : fechaFormateada;
    }
    return fechaStr;
}

function registrarLog(usuario, accion, mantenimiento_id, detalles) {
    try {
        const fechaUTC4 = obtenerHoraUTC4(); 
        db.prepare(`INSERT INTO logs_auditoria (usuario, accion, mantenimiento_id, fecha, detalles) VALUES (?, ?, ?, ?, ?)`).run(usuario || 'Sistema', accion, mantenimiento_id, fechaUTC4, detalles);
    } catch (err) {}
}

// =====================================================
// TABLAS E INICIALIZACIÓN
// =====================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS mantenimientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, estructura TEXT, ubicacion TEXT, tipo_mantenimiento TEXT, elemento TEXT, descripcion TEXT, observaciones TEXT, creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS estructuras (
        id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL UNIQUE, tipo TEXT NOT NULL, ubicacion TEXT, estado TEXT, latitud TEXT, longitud TEXT, observaciones TEXT, creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, password TEXT NOT NULL, rol TEXT DEFAULT 'Tecnico', activo INTEGER DEFAULT 1, creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS logs_auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT NOT NULL, accion TEXT NOT NULL, mantenimiento_id INTEGER, fecha TEXT DEFAULT CURRENT_TIMESTAMP, detalles TEXT
    );
    CREATE TABLE IF NOT EXISTS plan_mantenimiento (
        id INTEGER PRIMARY KEY AUTOINCREMENT, año INTEGER NOT NULL DEFAULT 2026, mes INTEGER NOT NULL, placa TEXT NOT NULL, tipo TEXT NOT NULL, ejecutado_manual INTEGER DEFAULT 0, creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

try { db.prepare(`ALTER TABLE plan_mantenimiento ADD COLUMN año INTEGER DEFAULT 2026`).run(); } catch(e){}

const columnasEquipos = [["marca", "TEXT"], ["modelo", "TEXT"], ["numero_serie", "TEXT"], ["fecha_instalacion", "TEXT"], ["salud_porcentaje", "INTEGER DEFAULT 100"], ["criticidad", "TEXT DEFAULT 'Normal'"]];
for (const [columna, tipo] of columnasEquipos) { try { db.prepare(`ALTER TABLE estructuras ADD COLUMN ${columna} ${tipo}`).run(); } catch (error) {} }

const columnasMantenimiento = [["realizado_por", "TEXT"], ["tiene_pendiente", "TEXT DEFAULT 'No'"], ["pendiente", "TEXT"], ["latitud", "TEXT"], ["longitud", "TEXT"], ["fotos", "TEXT"], ["aislamiento_ohm", "TEXT"], ["resistencia_contacto", "TEXT"], ["accion_recomendada", "TEXT"], ["causa_falla", "TEXT"], ["tiempo_inactividad", "INTEGER"]];
for (const [columna, tipo] of columnasMantenimiento) { try { db.prepare(`ALTER TABLE mantenimientos ADD COLUMN ${columna} ${tipo}`).run(); } catch (error) {} }

const cantidadUsuarios = db.prepare(`SELECT COUNT(*) AS total FROM usuarios`).get();
if (cantidadUsuarios.total === 0) {
    db.prepare(`INSERT INTO usuarios (usuario, nombre, password, rol, activo) VALUES (?, ?, ?, ?, ?)`).run("admin", "Administrador", crearHash("admin123"), "Administrador", 1);
}

// =====================================================
// CONFIGURACIÓN EXPRESS Y SESIONES
// =====================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "20mb" }));
app.use(session({ secret: "OCRIS-LOCAL-2026-SECRET", resave: false, saveUninitialized: false, cookie: { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 } }));

app.get("/login.html", (req, res) => { if (req.session.usuario) return res.redirect("/"); res.sendFile(path.join(__dirname, "public", "login.html")); });
app.post("/api/login", (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) return res.status(400).json({ ok: false, mensaje: "Ingrese datos" });
    const usuarioDB = db.prepare(`SELECT * FROM usuarios WHERE usuario = ? AND activo = 1`).get(usuario);
    if (!usuarioDB || !comprobarPassword(password, usuarioDB.password)) return res.status(401).json({ ok: false, mensaje: "Incorrectos" });
    req.session.usuario = { id: usuarioDB.id, usuario: usuarioDB.usuario, nombre: usuarioDB.nombre, rol: usuarioDB.rol };
    req.session.save(() => { res.json({ ok: true }); });
});
app.post("/api/logout", (req, res) => { req.session.destroy(() => { res.json({ ok: true }); }); });
app.get("/api/usuario", (req, res) => { if (!req.session.usuario) return res.status(401).json({ ok: false }); res.json({ ok: true, usuario: req.session.usuario }); });

function requiereLogin(req, res, next) { if (req.session.usuario) return next(); if (req.path.startsWith("/api/")) return res.status(401).json({ ok: false }); return res.redirect("/login.html"); }
function requiereAdmin(req, res, next) { if (req.session.usuario && req.session.usuario.rol === 'Administrador') return next(); if (req.path.startsWith("/api/")) return res.status(403).json({ ok: false }); return res.redirect("/login.html"); }

app.use((req, res, next) => {
    if (req.path === "/login.html" || req.path === "/api/login" || req.path.startsWith("/css/") || req.path.startsWith("/js/") || req.path.startsWith("/img/") || req.path.startsWith("/librerias/")) return next();
    requiereLogin(req, res, next);
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "public", "index.html")); });
app.get("/api/backup", requiereAdmin, (req, res) => { res.download(path.join(__dirname, "ocris.db"), `ocris_backup_${new Date().toISOString().split('T')[0]}.db`); });

// =====================================================
// PLAN DE MANTENIMIENTO (CRUD BASE DE DATOS)
// =====================================================
app.get("/api/plan", (req, res) => {
    try { res.json(db.prepare(`SELECT * FROM plan_mantenimiento ORDER BY año ASC, mes ASC, id DESC`).all()); } 
    catch (e) { res.status(500).json({ error: "Error al obtener plan" }); }
});

app.post("/api/plan", requiereAdmin, (req, res) => {
    const { año, mes, placa, tipo, ejecutado_manual } = req.body;
    try {
        const result = db.prepare(`INSERT INTO plan_mantenimiento (año, mes, placa, tipo, ejecutado_manual) VALUES (?, ?, ?, ?, ?)`).run(año, mes, placa, tipo || 'Varios', ejecutado_manual ? 1 : 0);
        res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) { res.status(500).json({ ok: false }); }
});

app.post("/api/plan/masivo", requiereAdmin, (req, res) => {
    const { equipos } = req.body;
    try {
        const insert = db.prepare(`INSERT INTO plan_mantenimiento (año, mes, placa, tipo, ejecutado_manual) VALUES (?, ?, ?, ?, ?)`);
        const insertMany = db.transaction((lista) => { 
            for (const eq of lista) insert.run(eq.año, eq.mes, eq.placa, eq.tipo, eq.ejecutado_manual ? 1 : 0); 
        });
        insertMany(equipos);
        res.json({ ok: true, mensaje: "Plan cargado correctamente" });
    } catch (e) { res.status(500).json({ ok: false }); }
});

app.put("/api/plan/:id/estado", requiereAdmin, (req, res) => {
    const { ejecutado } = req.body;
    try {
        db.prepare(`UPDATE plan_mantenimiento SET ejecutado_manual = ? WHERE id = ?`).run(ejecutado ? 1 : 0, req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

app.delete("/api/plan/lote", requiereAdmin, (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ ok: false });
    try {
        const stmt = db.prepare(`DELETE FROM plan_mantenimiento WHERE id = ?`);
        const borrarLote = db.transaction((lista) => { for (const id of lista) stmt.run(id); });
        borrarLote(ids);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

app.delete("/api/plan/masivo", requiereAdmin, (req, res) => {
    try { db.prepare(`DELETE FROM plan_mantenimiento`).run(); db.prepare(`DELETE FROM sqlite_sequence WHERE name='plan_mantenimiento'`).run(); res.json({ ok: true }); } 
    catch (e) { res.status(500).json({ ok: false }); }
});

app.delete("/api/plan/:id", requiereAdmin, (req, res) => {
    try { db.prepare(`DELETE FROM plan_mantenimiento WHERE id = ?`).run(req.params.id); res.json({ ok: true }); } 
    catch (e) { res.status(500).json({ ok: false }); }
});

// =====================================================
// MANTENIMIENTOS Y ESTRUCTURAS
// =====================================================
app.post("/api/mantenimientos", subirFotos.array("fotografias", 4), (req, res) => {
    const { fecha, estructura, ubicacion, tipo_mantenimiento, elemento, descripcion, observaciones, tiene_pendiente, pendiente, latitud, longitud, aislamiento_ohm, resistencia_contacto, causa_falla, tiempo_inactividad } = req.body;
    const usr = req.session.usuario.usuario;
    const pendEx = (String(tiene_pendiente||"").toUpperCase() === "SÍ" || String(tiene_pendiente||"").toUpperCase() === "SI");
    try {
        const r = db.prepare(`
            INSERT INTO mantenimientos (
                fecha, estructura, ubicacion, tipo_mantenimiento, elemento, 
                descripcion, observaciones, realizado_por, tiene_pendiente, 
                pendiente, latitud, longitud, fotos, aislamiento_ohm, resistencia_contacto, 
                causa_falla, tiempo_inactividad, creado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            fecha || "", estructura || "", ubicacion || "", tipo_mantenimiento || "", elemento || "", 
            descripcion || "", observaciones || "", usr || "", pendEx ? "Sí" : "No", 
            pendEx ? (pendiente || "") : null, latitud || null, longitud || null, 
            JSON.stringify((req.files||[]).map(f=>f.filename)), 
            aislamiento_ohm || null, resistencia_contacto || null, causa_falla || null, tiempo_inactividad || null, 
            obtenerHoraUTC4()
        );
        res.json({ ok: true, id: r.lastInsertRowid });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ ok: false, mensaje: "Error interno" }); 
    }
});

app.get("/api/mantenimientos", (req, res) => {
    try { res.json(db.prepare(`SELECT * FROM mantenimientos ORDER BY id DESC`).all().map(m => ({ ...m, fotos: JSON.parse(m.fotos || "[]") }))); } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get("/api/mantenimientos/:id/pdf", async (req, res) => {
    try {
        const m = db.prepare(`SELECT * FROM mantenimientos WHERE id = ?`).get(req.params.id);
        if (!m) return res.status(404).send("No encontrado");
        let f = []; try { f = JSON.parse(m.fotos || "[]"); } catch(e){}
        let eq = db.prepare(`SELECT * FROM estructuras WHERE codigo = ?`).get(m.estructura);
        
        const doc = new PDFDocument({ size: "A4", margin: 45 });
        res.setHeader("Content-Type", "application/pdf"); 
        res.setHeader("Content-Disposition", `inline; filename="informe-${m.id}.pdf"`);
        doc.pipe(res);
        
        const rutaLogo = path.join(__dirname, "public", "img", "logo.png");
        if (fs.existsSync(rutaLogo)) doc.image(rutaLogo, 45, 35, { width: 60 });
        
        doc.fillColor("#0b3d62").fontSize(24).font("Helvetica-Bold").text("OCRIS", { align: "center" }).fontSize(12).font("Helvetica").text("Mantenimiento de Equipos de Red GOSSR", { align: "center" }).moveDown().moveTo(45, doc.y).lineTo(550, doc.y).strokeColor("#0b3d62").stroke().moveDown();
        doc.fillColor("#0b3d62").fontSize(18).font("Helvetica-Bold").text(`INFORME DE MANTENIMIENTO #${m.id}`).moveDown();
        
        function linea(etq, val) { doc.fillColor("#1f2937").fontSize(11).font("Helvetica-Bold").text(`${etq}: `, { continued: true }).font("Helvetica").text(String(val || "No registrado")); }
        
        linea("Fecha", formatoDDMMAAAA(m.fecha)); linea("Equipo", m.estructura); linea("Ubicación", m.ubicacion); linea("Tipo", m.tipo_mantenimiento); linea("Elemento", m.elemento); linea("Realizado por", m.realizado_por); doc.moveDown();
        if (eq) { doc.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("DATOS DEL EQUIPO").moveDown(0.5); linea("Código", eq.codigo); linea("Tipo", eq.tipo); linea("Marca", eq.marca); linea("N. serie", eq.numero_serie); doc.moveDown(); }
        if (m.tipo_mantenimiento === 'Correctivo' || m.tipo_mantenimiento === 'Emergencia') { doc.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("CONFIABILIDAD (RCM/TPM)").moveDown(0.5); linea("Causa Raíz", m.causa_falla); linea("Downtime (min)", m.tiempo_inactividad); doc.moveDown(); }
        
        // DIBUJO LIMPIO DEL TRABAJO REALIZADO (Soluciona el error del símbolo Ð)
        doc.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("TRABAJO REALIZADO").moveDown(0.5); 
        doc.fillColor("#1f2937").fontSize(10).font("Helvetica");
        const lineasDesc = String(m.descripcion || "").split(/\r?\n/);
        lineasDesc.forEach(l => { if (l.trim() !== "") doc.text(l.trim()); });
        doc.moveDown();
        
        if(m.aislamiento_ohm || m.resistencia_contacto) { doc.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("MEDICIONES").moveDown(0.5); linea("Aislamiento", m.aislamiento_ohm); linea("Resistencia Contacto", m.resistencia_contacto); doc.moveDown(); }
        
        // DIBUJO LIMPIO DE OBSERVACIONES
        doc.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("OBSERVACIONES").moveDown(0.5); 
        doc.fillColor("#1f2937").fontSize(10).font("Helvetica");
        const lineasObs = String(m.observaciones || "").split(/\r?\n/);
        lineasObs.forEach(l => { if (l.trim() !== "") doc.text(l.trim()); });
        doc.moveDown();
        
        if ((m.tiene_pendiente||"").toUpperCase() === "SÍ" || (m.tiene_pendiente||"").toUpperCase() === "SI") { 
            doc.roundedRect(45, doc.y, 505, 70, 6).fill("#fee2e2"); 
            doc.fillColor("#991b1b").fontSize(15).font("Helvetica-Bold").text("[ ! ] ATENCION: PENDIENTE"); 
            doc.fillColor("#7f1d1d").fontSize(10).font("Helvetica");
            const lineasPendiente = String(m.pendiente || "").split(/\r?\n/);
            lineasPendiente.forEach(l => { if (l.trim() !== "") doc.text(l.trim()); });
            doc.moveDown(); 
        } else { 
            doc.fillColor("#166534").fontSize(12).font("Helvetica-Bold").text("[ OK ] SIN PENDIENTES").moveDown(); 
        }
        
        if (f.length > 0) { doc.fillColor("#0b3d62").fontSize(14).font("Helvetica-Bold").text("EVIDENCIAS").moveDown(); let pY = doc.y; let cA = 0; for(let i=0;i<f.length;i++){ let rF=path.join(carpetaFotos, f[i]); if(fs.existsSync(rF)){ if(pY+180>750){doc.addPage(); pY=50; cA=0;} doc.image(rF, cA===0?45:310, pY, {fit:[230,180], align:"center", valign:"center"}); cA = cA===0?1:0; if(cA===0) pY+=200; } } }
        doc.end();
    } catch (e) { res.status(500).json({ ok: false }); }
});

app.put("/api/mantenimientos/:id", subirFotos.array("fotografias", 4), (req, res) => {
    const id = req.params.id;
    const { fecha, estructura, ubicacion, tipo_mantenimiento, elemento, descripcion, observaciones, tiene_pendiente, pendiente, fotosRestantes, aislamiento_ohm, resistencia_contacto, causa_falla, tiempo_inactividad } = req.body;
    const usuarioActual = req.session.usuario.usuario;
    const pendEx = (String(tiene_pendiente || "No").trim().toUpperCase() === "SÍ" || String(tiene_pendiente || "No").trim().toUpperCase() === "SI");
    
    try {
        const mantActual = db.prepare(`SELECT fotos FROM mantenimientos WHERE id = ?`).get(id);
        if (!mantActual) return res.status(404).json({ ok: false, mensaje: "No encontrado" });
        
        let fotosViejas = []; try { fotosViejas = JSON.parse(mantActual.fotos || "[]"); } catch (e) {}
        let fotosQueSeQuedan = fotosRestantes ? JSON.parse(fotosRestantes) : fotosViejas;
        const fotosParaBorrar = fotosViejas.filter(f => !fotosQueSeQuedan.includes(f));
        fotosParaBorrar.forEach(nombreFoto => { const rutaFoto = path.join(carpetaFotos, nombreFoto); if (fs.existsSync(rutaFoto)) { try { fs.unlinkSync(rutaFoto); } catch(e){} } });

        const fotosJSON = JSON.stringify([...fotosQueSeQuedan, ...(req.files || []).map(a => a.filename)]);

        db.prepare(`
            UPDATE mantenimientos 
            SET fecha=?, estructura=?, ubicacion=?, tipo_mantenimiento=?, elemento=?, descripcion=?, observaciones=?, tiene_pendiente=?, pendiente=?, fotos=?, aislamiento_ohm=?, resistencia_contacto=?, causa_falla=?, tiempo_inactividad=?
            WHERE id=?
        `).run(
            fecha || "", estructura || "", ubicacion || "", tipo_mantenimiento || "", elemento || "", 
            descripcion || "", observaciones || "", pendEx ? "Sí" : "No", pendEx ? (pendiente || "") : null, 
            fotosJSON, aislamiento_ohm || null, resistencia_contacto || null, causa_falla || null, tiempo_inactividad || null, 
            id
        );

        registrarLog(usuarioActual, 'EDICION', id, `Editó el registro.`);
        res.json({ ok: true, mensaje: "Mantenimiento actualizado" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, mensaje: "Error al actualizar" });
    }
});

app.delete("/api/mantenimientos/:id", requiereAdmin, (req, res) => {
    const id = req.params.id; const usuarioActual = req.session.usuario.usuario;
    try {
        const mantenimiento = db.prepare(`SELECT fotos FROM mantenimientos WHERE id = ?`).get(id);
        if (!mantenimiento) return res.status(404).json({ ok: false, mensaje: "Mantenimiento no encontrado" });
        if (mantenimiento.fotos) { try { JSON.parse(mantenimiento.fotos).forEach(nombreFoto => { const rutaFoto = path.join(carpetaFotos, nombreFoto); if (fs.existsSync(rutaFoto)) fs.unlinkSync(rutaFoto); }); } catch (err) {} }
        db.prepare(`DELETE FROM mantenimientos WHERE id = ?`).run(id);
        registrarLog(usuarioActual, 'ELIMINACION', id, `Eliminó el mantenimiento`);
        res.json({ ok: true, mensaje: "Mantenimiento eliminado" });
    } catch (error) { res.status(500).json({ ok: false, mensaje: "Error al eliminar" }); }
});

// =====================================================
// LOGS Y USUARIOS
// =====================================================
app.get("/api/logs", requiereAdmin, (req, res) => { res.json(db.prepare(`SELECT * FROM logs_auditoria ORDER BY id DESC LIMIT 100`).all().map(l => ({ ...l, fecha: formatoDDMMAAAA(l.fecha) }))); });
app.get("/api/estructuras", (req, res) => { res.json(db.prepare(`SELECT * FROM estructuras ORDER BY id DESC`).all()); });
app.post("/api/estructuras", (req, res) => { try { const r=db.prepare(`INSERT INTO estructuras (codigo, tipo, marca, modelo, numero_serie, fecha_instalacion, ubicacion, estado, latitud, longitud, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(req.body.codigo, req.body.tipo, req.body.marca, req.body.modelo, req.body.numero_serie, req.body.fecha_instalacion, req.body.ubicacion, req.body.estado, req.body.latitud, req.body.longitud, req.body.observaciones); res.json({ ok: true, id: r.lastInsertRowid }); } catch(e){ res.status(500).json({ ok: false }); } });
app.put("/api/estructuras/:id", (req, res) => { try { db.prepare(`UPDATE estructuras SET codigo=?, tipo=?, marca=?, modelo=?, numero_serie=?, fecha_instalacion=?, ubicacion=?, estado=?, latitud=?, longitud=?, observaciones=? WHERE id=?`).run(req.body.codigo, req.body.tipo, req.body.marca, req.body.modelo, req.body.numero_serie, req.body.fecha_instalacion, req.body.ubicacion, req.body.estado, req.body.latitud, req.body.longitud, req.body.observaciones, req.params.id); res.json({ ok: true }); } catch(e){ res.status(500).json({ok:false}); }});
app.delete("/api/estructuras/masivo", requiereAdmin, (req, res) => { try { db.prepare(`DELETE FROM estructuras`).run(); db.prepare(`DELETE FROM sqlite_sequence WHERE name='estructuras'`).run(); res.json({ ok: true }); } catch(e){ res.status(500).json({ok:false}); }});
app.delete("/api/estructuras/:id", requiereAdmin, (req, res) => { try { db.prepare(`DELETE FROM estructuras WHERE id = ?`).run(req.params.id); res.json({ ok: true }); } catch(e){ res.status(500).json({ok:false}); }});
app.get("/api/usuarios", requiereAdmin, (req, res) => { res.json(db.prepare(`SELECT id, usuario, nombre, rol, activo, creado_en FROM usuarios ORDER BY id DESC`).all()); });

app.listen(PORT, () => {
    console.log("================================\n             OCRIS\n================================");
    console.log(`Servidor activo en puerto: ${PORT}\n================================`);
});