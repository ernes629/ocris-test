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
const carpetaFotos = path.join(
    __dirname,
    "public",
    "uploads",
    "mantenimientos"
);

if (!fs.existsSync(carpetaFotos)) {
    fs.mkdirSync(
        carpetaFotos,
        {
            recursive: true
        }
    );
}

// =====================================================
// CONFIGURACIÓN DE MULTER
// =====================================================
const almacenamientoFotos =
    multer.diskStorage({
        destination: function (req, file, cb) {
            cb(
                null,
                carpetaFotos
            );
        },
        filename: function (req, file, cb) {
            const extension =
                path.extname(
                    file.originalname
                ).toLowerCase();
            const nombre =
                `foto-${Date.now()}-${crypto.randomBytes(5).toString("hex")}${extension}`;
            cb(
                null,
                nombre
            );
        }
    });

const subirFotos =
    multer({
        storage:
            almacenamientoFotos,
        limits: {
            files: 10,
            fileSize:
                10 * 1024 * 1024
        },
        fileFilter:
            function (
                req,
                file,
                cb
            ) {
                const tiposPermitidos = [
                    "image/jpeg",
                    "image/jpg",
                    "image/png",
                    "image/webp",
                    "image/heic",
                    "image/heif"
                ];

                if (
                    tiposPermitidos.includes(
                        file.mimetype
                    )
                ) {
                    cb(
                        null,
                        true
                    );
                } else {
                    cb(
                        new Error(
                            "Solo se permiten fotografías."
                        )
                    );
                }
            }
    });

// =====================================================
// FUNCIONES DE CONTRASEÑA
// =====================================================
function crearHash(password) {
    const salt =
        crypto
            .randomBytes(16)
            .toString("hex");
    const hash =
        crypto
            .pbkdf2Sync(
                password,
                salt,
                100000,
                64,
                "sha512"
            )
            .toString("hex");
    return `${salt}:${hash}`;
}

function comprobarPassword(
    password,
    almacenada
) {
    const partes =
        almacenada.split(":");
    if (
        partes.length !== 2
    ) {
        return false;
    }
    const salt =
        partes[0];
    const hashOriginal =
        partes[1];
    const hashCalculado =
        crypto
            .pbkdf2Sync(
                password,
                salt,
                100000,
                64,
                "sha512"
            )
            .toString("hex");

    return crypto.timingSafeEqual(
        Buffer.from(
            hashOriginal,
            "hex"
        ),
        Buffer.from(
            hashCalculado,
            "hex"
        )
    );
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
// AGREGAR CAMPOS TÉCNICOS A EQUIPOS
// =====================================================
const columnasEquipos = [
    ["marca", "TEXT"],
    ["modelo", "TEXT"],
    ["numero_serie", "TEXT"],
    ["fecha_instalacion", "TEXT"]
];

for (
    const [columna, tipo]
    of columnasEquipos
) {
    try {
        db.prepare(`
            ALTER TABLE estructuras
            ADD COLUMN ${columna} ${tipo}
        `).run();
        console.log(
            `Columna ${columna} agregada.`
        );
    } catch (error) {
        // La columna ya existe.
    }
}

// =====================================================
// AGREGAR CAMPOS NUEVOS A MANTENIMIENTOS
// =====================================================
const columnasMantenimiento = [
    ["realizado_por", "TEXT"],
    ["tiene_pendiente", "TEXT DEFAULT 'No'"],
    ["pendiente", "TEXT"],
    ["latitud", "TEXT"],
    ["longitud", "TEXT"],
    ["fotos", "TEXT"]
];

for (
    const [columna, tipo]
    of columnasMantenimiento
) {
    try {
        db.prepare(`
            ALTER TABLE mantenimientos
            ADD COLUMN ${columna} ${tipo}
        `).run();
        console.log(
            `Columna ${columna} agregada a mantenimientos.`
        );
    } catch (error) {
        // La columna ya existe.
    }
}

// =====================================================
// CREAR USUARIO ADMINISTRADOR INICIAL
// =====================================================
const cantidadUsuarios =
    db.prepare(`
        SELECT COUNT(*) AS total
        FROM usuarios
    `).get();

if (
    cantidadUsuarios.total === 0
) {
    const passwordHash =
        crearHash(
            "admin123"
        );
    db.prepare(`
        INSERT INTO usuarios (
            usuario,
            nombre,
            password,
            rol,
            activo
        )
        VALUES (?, ?, ?, ?, ?)
    `).run(
        "admin",
        "Administrador",
        passwordHash,
        "Administrador",
        1
    );

    console.log("");
    console.log(
        "================================"
    );
    console.log(
        " USUARIO ADMINISTRADOR CREADO"
    );
    console.log(
        "================================"
    );
    console.log(
        "Usuario: admin"
    );
    console.log(
        "Contraseña: admin123"
    );
    console.log(
        "================================"
    );
    console.log("");
}

// =====================================================
// CONFIGURACIÓN EXPRESS
// =====================================================
app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.json({
        limit: "20mb"
    })
);

// =====================================================
// SESIONES
// =====================================================
app.use(
    session({
        secret:
            "OCRIS-LOCAL-2026-SECRET-CAMBIAR",
        resave:
            false,
        saveUninitialized:
            false,
        cookie: {
            httpOnly: true,
            maxAge:
                8 * 60 * 60 * 1000
        }
    })
);

// =====================================================
// PÁGINA LOGIN
// =====================================================
app.get(
    "/login.html",
    (req, res) => {
        if (
            req.session.usuario
        ) {
            return res.redirect(
                "/"
            );
        }
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "login.html"
            )
        );
    }
);

// =====================================================
// LOGIN
// =====================================================
app.post(
    "/api/login",
    (req, res) => {
        const {
            usuario,
            password
        } = req.body;

        if (
            !usuario ||
            !password
        ) {
            return res.status(400).json({
                ok: false,
                mensaje:
                    "Ingrese usuario y contraseña"
            });
        }

        const usuarioDB =
            db.prepare(`
                SELECT *
                FROM usuarios
                WHERE usuario = ?
                AND activo = 1
            `).get(
                usuario
            );

        if (!usuarioDB) {
            return res.status(401).json({
                ok: false,
                mensaje:
                    "Usuario o contraseña incorrectos"
            });
        }

        const correcta =
            comprobarPassword(
                password,
                usuarioDB.password
            );

        if (!correcta) {
            return res.status(401).json({
                ok: false,
                mensaje:
                    "Usuario o contraseña incorrectos"
            });
        }

        req.session.usuario = {
            id:
                usuarioDB.id,
            usuario:
                usuarioDB.usuario,
            nombre:
                usuarioDB.nombre,
            rol:
                usuarioDB.rol
        };

        // CORRECCIÓN APLICADA: Guardar sesión antes de responder
        req.session.save((err) => {
            if (err) {
                console.error("Error al guardar sesión:", err);
                return res.status(500).json({
                    ok: false,
                    mensaje: "Error interno al guardar sesión"
                });
            }
            
            res.json({
                ok: true,
                mensaje:
                    "Inicio de sesión correcto"
            });
        });
    }
);

// =====================================================
// CERRAR SESIÓN
// =====================================================
app.post(
    "/api/logout",
    (req, res) => {
        req.session.destroy(
            () => {
                res.json({
                    ok: true
                });
            }
        );
    }
);

// =====================================================
// USUARIO ACTUAL
// =====================================================
app.get(
    "/api/usuario",
    (req, res) => {
        if (
            !req.session.usuario
        ) {
            return res.status(401).json({
                ok: false
            });
        }
        res.json({
            ok: true,
            usuario:
                req.session.usuario
        });
    }
);

// =====================================================
// AUTENTICACIÓN
// =====================================================
function requiereLogin(
    req,
    res,
    next
) {
    if (
        req.session.usuario
    ) {
        return next();
    }
    if (
        req.path.startsWith(
            "/api/"
        )
    ) {
        return res.status(401).json({
            ok: false,
            mensaje:
                "Debe iniciar sesión"
        });
    }
    return res.redirect(
        "/login.html"
    );
}

function requiereAdmin(req, res, next) {
    if (req.session.usuario && req.session.usuario.rol === 'Administrador') {
        return next();
    }
    if (req.path.startsWith("/api/")) {
        return res.status(403).json({
            ok: false,
            mensaje: "Acceso denegado. Se requieren permisos de Administrador."
        });
    }
    return res.redirect("/login.html");
}

// =====================================================
// ARCHIVOS PROTEGIDOS
// =====================================================
app.use(
    (req, res, next) => {
        // CORRECCIÓN APLICADA: Permitir recursos públicos
        if (
            req.path === "/login.html" ||
            req.path === "/api/login" ||
            req.path.startsWith("/css/") ||
            req.path.startsWith("/js/") ||
            req.path.startsWith("/img/") ||
            req.path.startsWith("/assets/")
        ) {
            return next();
        }

        requiereLogin(
            req,
            res,
            next
        );
    }
);

// =====================================================
// ARCHIVOS HTML
// =====================================================
app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================
app.get(
    "/",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

// =====================================================
// MANTENIMIENTOS
// =====================================================

// -----------------------------------------------------
// GUARDAR MANTENIMIENTO
// -----------------------------------------------------
app.post(
    "/api/mantenimientos",
    subirFotos.array(
        "fotografias",
        10
    ),
    (req, res) => {
        const {
            fecha,
            estructura,
            ubicacion,
            tipo_mantenimiento,
            elemento,
            descripcion,
            observaciones,
            tiene_pendiente,
            pendiente,
            latitud,
            longitud
        } = req.body;

        const usuarioActual =
            req.session.usuario;

        if (
            !usuarioActual
        ) {
            return res.status(401).json({
                ok: false,
                mensaje:
                    "Debe iniciar sesión"
            });
        }

        // ---------------------------------------------
        // VALIDAR PENDIENTE
        // ---------------------------------------------
        const valorPend = String(tiene_pendiente || "No").trim().toUpperCase();
        const pendienteExiste = (valorPend === "SÍ" || valorPend === "SI");

        let pendienteFinal = null;

        if (
            pendienteExiste
        ) {
            pendienteFinal =
                String(
                    pendiente || ""
                ).trim();

            if (
                !pendienteFinal
            ) {
                return res.status(400).json({
                    ok: false,
                    mensaje:
                        "Debe indicar cuál es el pendiente."
                });
            }
        }

        // ---------------------------------------------
        // GUARDAR NOMBRES DE FOTOGRAFÍAS
        // ---------------------------------------------
        const fotos =
            (req.files || [])
                .map(
                    archivo =>
                        archivo.filename
                );

        const fotosJSON =
            JSON.stringify(
                fotos
            );

        try {
            const guardar =
                db.prepare(`
                    INSERT INTO mantenimientos (
                        fecha,
                        estructura,
                        ubicacion,
                        tipo_mantenimiento,
                        elemento,
                        descripcion,
                        observaciones,
                        realizado_por,
                        tiene_pendiente,
                        pendiente,
                        latitud,
                        longitud,
                        fotos
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                `);

            const resultado =
                guardar.run(
                    fecha,
                    estructura,
                    ubicacion,
                    tipo_mantenimiento,
                    elemento,
                    descripcion,
                    observaciones,
                    usuarioActual.usuario,
                    pendienteExiste
                        ? "Sí"
                        : "No",
                    pendienteFinal,
                    latitud || null,
                    longitud || null,
                    fotosJSON
                );

            res.json({
                ok: true,
                mensaje:
                    "Mantenimiento guardado correctamente",
                id:
                    resultado.lastInsertRowid,
                pendiente:
                    pendienteExiste,
                fotos:
                    fotos.length
            });

        } catch (error) {
            console.error(
                "Error guardando mantenimiento:",
                error
            );

            // Si hubo error, eliminar fotos
            // que ya fueron subidas.
            for (
                const archivo
                of req.files || []
            ) {
                try {
                    fs.unlinkSync(
                        archivo.path
                    );
                } catch (e) {}
            }

            res.status(500).json({
                ok: false,
                mensaje:
                    "No se pudo guardar el mantenimiento"
            });
        }
    }
);

// -----------------------------------------------------
// OBTENER MANTENIMIENTOS
// -----------------------------------------------------
app.get(
    "/api/mantenimientos",
    (req, res) => {
        try {
            const mantenimientos =
                db.prepare(`
                    SELECT *
                    FROM mantenimientos
                    ORDER BY id DESC
                `).all();

            const resultado =
                mantenimientos.map(
                    mantenimiento => {
                        let fotos = [];
                        try {
                            fotos =
                                JSON.parse(
                                    mantenimiento.fotos ||
                                    "[]"
                                );
                        } catch (error) {
                            fotos = [];
                        }

                        return {
                            ...mantenimiento,
                            fotos
                        };
                    }
                );

            res.json(
                resultado
            );

        } catch (error) {
            console.error(
                error
            );

            res.status(500).json({
                error:
                    "No se pudieron obtener los mantenimientos"
            });
        }
    }
);

// =====================================================
// OBTENER UN MANTENIMIENTO
// =====================================================
app.get(
    "/api/mantenimientos/:id",
    (req, res) => {
        try {
            const mantenimiento =
                db.prepare(`
                    SELECT *
                    FROM mantenimientos
                    WHERE id = ?
                `).get(
                    req.params.id
                );

            if (
                !mantenimiento
            ) {
                return res.status(404).json({
                    ok: false,
                    mensaje:
                        "Mantenimiento no encontrado"
                });
            }

            let fotos = [];
            try {
                fotos =
                    JSON.parse(
                        mantenimiento.fotos ||
                        "[]"
                    );
            } catch (error) {
                fotos = [];
            }

            res.json({
                ok: true,
                mantenimiento: {
                    ...mantenimiento,
                    fotos
                }
            });

        } catch (error) {
            console.error(
                error
            );

            res.status(500).json({
                ok: false,
                mensaje:
                    "No se pudo obtener el mantenimiento"
            });
        }
    }
);

// =====================================================
// GENERAR PDF DEL MANTENIMIENTO
// =====================================================
app.get(
    "/api/mantenimientos/:id/pdf",
    async (req, res) => {
        try {
            const mantenimiento =
                db.prepare(`
                    SELECT *
                    FROM mantenimientos
                    WHERE id = ?
                `).get(
                    req.params.id
                );

            if (
                !mantenimiento
            ) {
                return res.status(404).send(
                    "Mantenimiento no encontrado"
                );
            }

            // -----------------------------------------
            // FOTOGRAFÍAS
            // -----------------------------------------
            let fotos = [];
            try {
                fotos =
                    JSON.parse(
                        mantenimiento.fotos ||
                        "[]"
                    );
            } catch (error) {
                fotos = [];
            }

            // -----------------------------------------
            // EQUIPO
            // -----------------------------------------
            let equipo = null;
            if (
                mantenimiento.estructura
            ) {
                equipo =
                    db.prepare(`
                        SELECT *
                        FROM estructuras
                        WHERE codigo = ?
                    `).get(
                        mantenimiento.estructura
                    );
            }

            // -----------------------------------------
            // PDF
            // -----------------------------------------
            const documento =
                new PDFDocument({
                    size:
                        "A4",
                    margin:
                        45,
                    info: {
                        Title:
                            `Informe de Mantenimiento #${mantenimiento.id}`,
                        Author:
                            "OCRIS",
                        // CORRECCIÓN APLICADA: Subject modificado
                        Subject:
                            "Mantenimiento de Equipos de Red GOSSR"
                    }
                });

            const nombreArchivo =
                `informe-mantenimiento-${mantenimiento.id}.pdf`;

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `inline; filename="${nombreArchivo}"`
            );

            documento.pipe(
                res
            );

            // -----------------------------------------
            // ENCABEZADO Y LOGO
            // -----------------------------------------
            const rutaLogo = path.join(__dirname, "public", "img", "logo.png");
            
            // Si el archivo logo.png existe, lo dibuja en la esquina superior izquierda
            if (fs.existsSync(rutaLogo)) {
                documento.image(rutaLogo, 45, 35, { width: 60 });
            }

            documento
                .fillColor("#0b3d62")
                .fontSize(24)
                .font("Helvetica-Bold")
                .text(
                    "OCRIS",
                    {
                        align: "center"
                    }
                );

            // CORRECCIÓN APLICADA: Subtítulo modificado
            documento
                .fillColor("#334155")
                .fontSize(12)
                .font("Helvetica")
                .text(
                    "Mantenimiento de Equipos de Red GOSSR (OCRI, RECLOSER, REGULADORES)",
                    {
                        align: "center"
                    }
                );

            documento.moveDown();

            documento
                .moveTo(45, documento.y)
                .lineTo(550, documento.y)
                .strokeColor("#0b3d62")
                .stroke();

            documento.moveDown();

            documento
                .fillColor("#0b3d62")
                .fontSize(18)
                .font("Helvetica-Bold")
                .text(
                    `INFORME DE MANTENIMIENTO #${mantenimiento.id}`
                );

            documento.moveDown();

            // -----------------------------------------
            // DATOS GENERALES
            // -----------------------------------------
            documento
                .fillColor("#1f2937")
                .fontSize(11)
                .font("Helvetica");

            function linea(
                etiqueta,
                valor
            ) {
                documento
                    .font("Helvetica-Bold")
                    .text(
                        `${etiqueta}: `,
                        {
                            continued: true
                        }
                    )
                    .font("Helvetica")
                    .text(
                        valor ||
                        "No registrado"
                    );
            }

            linea(
                "Fecha",
                mantenimiento.fecha
            );

            linea(
                "Equipo",
                mantenimiento.estructura
            );

            linea(
                "Ubicación",
                mantenimiento.ubicacion
            );

            linea(
                "Tipo de mantenimiento",
                mantenimiento.tipo_mantenimiento
            );

            linea(
                "Elemento intervenido",
                mantenimiento.elemento
            );

            linea(
                "Realizado por",
                mantenimiento.realizado_por
            );

            documento.moveDown();

            // -----------------------------------------
            // INFORMACIÓN DEL EQUIPO
            // -----------------------------------------
            if (
                equipo
            ) {
                documento
                    .fillColor("#0b3d62")
                    .fontSize(14)
                    .font("Helvetica-Bold")
                    .text(
                        "DATOS DEL EQUIPO"
                    );

                documento.moveDown(0.5);

                documento
                    .fillColor("#1f2937")
                    .fontSize(10)
                    .font("Helvetica");

                linea(
                    "Código",
                    equipo.codigo
                );

                linea(
                    "Tipo",
                    equipo.tipo
                );

                linea(
                    "Marca",
                    equipo.marca
                );

                linea(
                    "Modelo",
                    equipo.modelo
                );

                linea(
                    "Número de serie",
                    equipo.numero_serie
                );

                linea(
                    "Estado",
                    equipo.estado
                );

                if (
                    equipo.fecha_instalacion
                ) {
                    linea(
                        "Fecha de instalación",
                        equipo.fecha_instalacion
                    );
                }

                documento.moveDown();
            }

            // -----------------------------------------
            // TRABAJO REALIZADO
            // -----------------------------------------
            documento
                .fillColor("#0b3d62")
                .fontSize(14)
                .font("Helvetica-Bold")
                .text(
                    "TRABAJO REALIZADO"
                );

            documento.moveDown(0.5);

            documento
                .fillColor("#1f2937")
                .fontSize(10)
                .font("Helvetica")
                .text(
                    mantenimiento.descripcion ||
                    "Sin descripción"
                );

            documento.moveDown();

            // -----------------------------------------
            // OBSERVACIONES
            // -----------------------------------------
            documento
                .fillColor("#0b3d62")
                .fontSize(14)
                .font("Helvetica-Bold")
                .text(
                    "OBSERVACIONES"
                );

            documento.moveDown(0.5);

            documento
                .fillColor("#1f2937")
                .fontSize(10)
                .font("Helvetica")
                .text(
                    mantenimiento.observaciones ||
                    "Sin observaciones"
                );

            documento.moveDown();

            // -----------------------------------------
            // PENDIENTE
            // -----------------------------------------
            const existePendiente =
                String(
                    mantenimiento.tiene_pendiente ||
                    "No"
                ).trim() === "Sí";

            if (
                existePendiente
            ) {
                documento
                    .roundedRect(
                        45,
                        documento.y,
                        505,
                        70,
                        6
                    )
                    .fill("#fee2e2");

                documento
                    .fillColor("#991b1b")
                    .fontSize(15)
                    .font("Helvetica-Bold")
                    .text(
                        "⚠ PENDIENTE"
                    );

                documento
                    .fillColor("#7f1d1d")
                    .fontSize(10)
                    .font("Helvetica")
                    .text(
                        mantenimiento.pendiente ||
                        "Pendiente no especificado"
                    );

                documento.moveDown();
            } else {
                documento
                    .fillColor("#166534")
                    .fontSize(12)
                    .font("Helvetica-Bold")
                    .text(
                        "✓ MANTENIMIENTO SIN PENDIENTES"
                    );

                documento.moveDown();
            }

            // -----------------------------------------
            // UBICACIÓN GPS
            // -----------------------------------------
            if (
                mantenimiento.latitud &&
                mantenimiento.longitud
            ) {
                documento
                    .fillColor("#0b3d62")
                    .fontSize(14)
                    .font("Helvetica-Bold")
                    .text(
                        "UBICACIÓN GEOGRÁFICA"
                    );

                documento.moveDown(0.5);

                documento
                    .fillColor("#1f2937")
                    .fontSize(10)
                    .font("Helvetica");

                linea(
                    "Latitud",
                    mantenimiento.latitud
                );

                linea(
                    "Longitud",
                    mantenimiento.longitud
                );

                documento.moveDown();
            }

            // -----------------------------------------
            // FOTOGRAFÍAS
            // -----------------------------------------
            if (
                fotos.length > 0
            ) {
                documento
                    .fillColor("#0b3d62")
                    .fontSize(14)
                    .font("Helvetica-Bold")
                    .text(
                        "EVIDENCIAS FOTOGRÁFICAS"
                    );

                documento.moveDown();

                // Aquí iniciaremos la lógica de cuadrícula
                let posicionY = documento.y;
                const anchoFoto = 230;
                const altoFoto = 180;
                let columnaActual = 0; // 0 = izquierda, 1 = derecha

                for (let i = 0; i < fotos.length; i++) {
                    const nombreFoto = fotos[i];
                    const rutaFoto = path.join(carpetaFotos, nombreFoto);

                    if (fs.existsSync(rutaFoto)) {
                        try {
                            // Salto de página si la foto ya no cabe en el alto de la hoja
                            if (posicionY + altoFoto > 750) {
                                documento.addPage();
                                posicionY = 50; // Margen superior en nueva página
                                columnaActual = 0;
                            }

                            // Posición X: 45 para la primera columna, 310 para la segunda
                            const posicionX = columnaActual === 0 ? 45 : 310;

                            documento.image(rutaFoto, posicionX, posicionY, {
                                fit: [anchoFoto, altoFoto],
                                align: "center",
                                valign: "center"
                            });

                            // Control de la cuadrícula
                            if (columnaActual === 0) {
                                // Era la foto izquierda, la siguiente va a la derecha en la misma altura
                                columnaActual = 1;
                            } else {
                                // Era la foto derecha, completamos la fila. Bajamos para la siguiente fila.
                                columnaActual = 0;
                                posicionY += altoFoto + 20; // 20px de margen inferior
                                documento.y = posicionY; 
                            }

                            // Si es la última foto impar, ajustamos el cursor del PDF para el pie de página
                            if (i === fotos.length - 1 && columnaActual === 1) {
                                posicionY += altoFoto + 20;
                                documento.y = posicionY;
                            }

                        } catch (error) {
                            console.error("No se pudo insertar foto:", error);
                        }
                    }
                }
            }
            // -----------------------------------------
            // PIE
            // -----------------------------------------
            documento
                .moveDown();

            documento
                .fillColor("#64748b")
                .fontSize(9)
                .font("Helvetica")
                .text(
                    `Informe generado por OCRIS - ${new Date().toLocaleString("es-ES")}`,
                    {
                        align: "center"
                    }
                );

            documento.end();

        } catch (error) {
            console.error(
                "Error generando PDF:",
                error
            );

            if (
                !res.headersSent
            ) {
                res.status(500).json({
                    ok: false,
                    mensaje:
                        "No se pudo generar el informe PDF"
                });
            }
        }
    }
);


// -----------------------------------------------------
// EDITAR MANTENIMIENTO (SOLO ADMIN)
// -----------------------------------------------------
// -----------------------------------------------------
// EDITAR MANTENIMIENTO (SOLO ADMIN) CON GESTIÓN DE FOTOS
// -----------------------------------------------------
app.put(
    "/api/mantenimientos/:id",
    requiereAdmin,
    subirFotos.array("fotografias", 10),
    (req, res) => {
        const id = req.params.id;
        const {
            fecha, estructura, ubicacion, tipo_mantenimiento,
            elemento, descripcion, observaciones, tiene_pendiente,
            pendiente, fotosRestantes // <-- Recibimos la lista de fotos que NO se borraron
        } = req.body;
        
        const usuarioActual = req.session.usuario.usuario;

        const valorPend = String(tiene_pendiente || "No").trim().toUpperCase();
        const pendienteExiste = (valorPend === "SÍ" || valorPend === "SI");
        const pendienteFinal = pendienteExiste ? String(pendiente || "").trim() : null;

        try {
            // 1. Rescatar fotos anteriores de la Base de Datos
            const mantActual = db.prepare(`SELECT fotos FROM mantenimientos WHERE id = ?`).get(id);
            if (!mantActual) return res.status(404).json({ ok: false, mensaje: "No encontrado" });
            
            let fotosViejas = [];
            try { fotosViejas = JSON.parse(mantActual.fotos || "[]"); } catch (e) {}

            // 2. Determinar cuáles fotos decidió conservar el usuario
            let fotosQueSeQuedan = fotosViejas;
            if (fotosRestantes) {
                try { fotosQueSeQuedan = JSON.parse(fotosRestantes); } catch (e) {}
            }

            // 3. Borrar del disco duro las fotos que el usuario quitó
            const fotosParaBorrar = fotosViejas.filter(f => !fotosQueSeQuedan.includes(f));
            fotosParaBorrar.forEach(nombreFoto => {
                const rutaFoto = path.join(carpetaFotos, nombreFoto);
                if (fs.existsSync(rutaFoto)) {
                    try { fs.unlinkSync(rutaFoto); } catch(e){}
                }
            });

            // 4. Sumar las fotos nuevas recién subidas
            const fotosNuevas = (req.files || []).map(archivo => archivo.filename);
            const fotosTotales = [...fotosQueSeQuedan, ...fotosNuevas];
            const fotosJSON = JSON.stringify(fotosTotales);

            // 5. Actualizar la base de datos
            const actualizar = db.prepare(`
                UPDATE mantenimientos 
                SET fecha = ?, estructura = ?, ubicacion = ?, tipo_mantenimiento = ?, 
                    elemento = ?, descripcion = ?, observaciones = ?, 
                    tiene_pendiente = ?, pendiente = ?, fotos = ?
                WHERE id = ?
            `);
            
            actualizar.run(
                fecha, estructura, ubicacion, tipo_mantenimiento, elemento, 
                descripcion, observaciones, pendienteExiste ? "Sí" : "No", 
                pendienteFinal, fotosJSON, id
            );

            // 6. Guardar Auditoría
            db.prepare(`
                INSERT INTO logs_auditoria (usuario, accion, mantenimiento_id, detalles) 
                VALUES (?, ?, ?, ?)
            `).run(
                usuarioActual, 'EDICION', id, `Editó ID: ${id}. Eliminó ${fotosParaBorrar.length} foto(s) y agregó ${fotosNuevas.length} nueva(s).`
            );

            res.json({ ok: true, mensaje: "Mantenimiento y fotografías actualizados" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ ok: false, mensaje: "Error al actualizar mantenimiento" });
        }
    }
);

// -----------------------------------------------------
// ELIMINAR MANTENIMIENTO (SOLO ADMIN)
// -----------------------------------------------------
app.delete(
    "/api/mantenimientos/:id",
    requiereAdmin,
    (req, res) => {
        const id = req.params.id;
        const usuarioActual = req.session.usuario.usuario;

        try {
            // 1. Consultar el mantenimiento ANTES de borrarlo para obtener los nombres de las fotos
            const mantenimiento = db.prepare(`SELECT fotos FROM mantenimientos WHERE id = ?`).get(id);

            if (!mantenimiento) {
                return res.status(404).json({ ok: false, mensaje: "Mantenimiento no encontrado" });
            }

            // 2. Borrar los archivos físicos de las fotos
            if (mantenimiento.fotos) {
                try {
                    const fotos = JSON.parse(mantenimiento.fotos);
                    fotos.forEach(nombreFoto => {
                        const rutaFoto = path.join(carpetaFotos, nombreFoto);
                        if (fs.existsSync(rutaFoto)) {
                            fs.unlinkSync(rutaFoto); // Borra el archivo del disco
                        }
                    });
                } catch (err) {
                    console.error("No se pudieron borrar las fotos físicas:", err);
                }
            }

            // 3. Borrar el registro de la base de datos
            const resultado = db.prepare(`DELETE FROM mantenimientos WHERE id = ?`).run(id);

            // 4. GUARDAR EN LOG DE AUDITORÍA
            db.prepare(`
                INSERT INTO logs_auditoria (usuario, accion, mantenimiento_id, detalles) 
                VALUES (?, ?, ?, ?)
            `).run(
                usuarioActual, 'ELIMINACION', id, `Eliminó el mantenimiento ID: ${id} y sus fotos del servidor`
            );

            res.json({ ok: true, mensaje: "Mantenimiento y fotografías eliminados correctamente" });
        } catch (error) {
            console.error(error);
            res.status(500).json({ ok: false, mensaje: "Error al eliminar mantenimiento" });
        }
    }
);

// -----------------------------------------------------
// CONSULTAR LOGS DE AUDITORÍA (SOLO ADMIN)
// -----------------------------------------------------
app.get(
    "/api/logs",
    requiereAdmin,
    (req, res) => {
        try {
            const logs = db.prepare(`SELECT * FROM logs_auditoria ORDER BY id DESC LIMIT 100`).all();
            res.json(logs);
        } catch (error) {
            console.error(error);
            res.status(500).json({ ok: false, mensaje: "Error al obtener los logs" });
        }
    }
);


// =====================================================
// EQUIPOS
// =====================================================

// -----------------------------------------------------
// GUARDAR EQUIPO
// -----------------------------------------------------
app.post(
    "/api/estructuras",
    (req, res) => {
        const {
            codigo,
            tipo,
            marca,
            modelo,
            numero_serie,
            fecha_instalacion,
            ubicacion,
            estado,
            latitud,
            longitud,
            observaciones
        } = req.body;

        try {
            const guardar =
                db.prepare(`
                    INSERT INTO estructuras (
                        codigo,
                        tipo,
                        marca,
                        modelo,
                        numero_serie,
                        fecha_instalacion,
                        ubicacion,
                        estado,
                        latitud,
                        longitud,
                        observaciones
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                `);

            const resultado =
                guardar.run(
                    codigo,
                    tipo,
                    marca,
                    modelo,
                    numero_serie,
                    fecha_instalacion,
                    ubicacion,
                    estado,
                    latitud,
                    longitud,
                    observaciones
                );

            res.json({
                ok: true,
                mensaje:
                    "Equipo guardado correctamente",
                id:
                    resultado.lastInsertRowid
            });

        } catch (error) {
            console.error(
                error
            );

            if (
                error.code ===
                "SQLITE_CONSTRAINT_UNIQUE"
            ) {
                return res.status(400).json({
                    ok: false,
                    mensaje:
                        "El código de equipo ya existe"
                });
            }

            res.status(500).json({
                ok: false,
                mensaje:
                    "No se pudo guardar el equipo"
            });
        }
    }
);

// -----------------------------------------------------
// OBTENER EQUIPOS
// -----------------------------------------------------
app.get(
    "/api/estructuras",
    (req, res) => {
        try {
            const equipos =
                db.prepare(`
                    SELECT *
                    FROM estructuras
                    ORDER BY id DESC
                `).all();

            res.json(
                equipos
            );

        } catch (error) {
            console.error(
                error
            );

            res.status(500).json({
                error:
                    "No se pudieron obtener los equipos"
            });
        }
    }
);

// -----------------------------------------------------
// ELIMINAR EQUIPO
// -----------------------------------------------------
app.delete(
    "/api/estructuras/:id",
    (req, res) => {
        try {
            const resultado =
                db.prepare(`
                    DELETE FROM estructuras
                    WHERE id = ?
                `).run(
                    req.params.id
                );

            if (
                resultado.changes === 0
            ) {
                return res.status(404).json({
                    ok: false,
                    mensaje:
                        "Equipo no encontrado"
                });
            }

            res.json({
                ok: true,
                mensaje:
                    "Equipo eliminado correctamente"
            });

        } catch (error) {
            console.error(
                error
            );

            res.status(500).json({
                ok: false,
                mensaje:
                    "No se pudo eliminar el equipo"
            });
        }
    }
);

// =====================================================
// GESTIÓN DE USUARIOS (SOLO ADMINISTRADORES)
// =====================================================

// -----------------------------------------------------
// OBTENER TODOS LOS USUARIOS
// -----------------------------------------------------
app.get("/api/usuarios", (req, res) => {
    // Validar que sea administrador
    if (req.session.usuario.rol !== "Administrador") {
        return res.status(403).json({ ok: false, mensaje: "Acceso denegado. Solo administradores." });
    }

    try {
        // Obtenemos todos menos la contraseña por seguridad
        const usuarios = db.prepare(`
            SELECT id, usuario, nombre, rol, activo, creado_en 
            FROM usuarios 
            ORDER BY id DESC
        `).all();

        res.json(usuarios);
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, mensaje: "Error al obtener usuarios" });
    }
});

// -----------------------------------------------------
// CREAR NUEVO USUARIO
// -----------------------------------------------------
app.post("/api/usuarios", (req, res) => {
    if (req.session.usuario.rol !== "Administrador") {
        return res.status(403).json({ ok: false, mensaje: "Acceso denegado." });
    }

    const { usuario, nombre, password, rol } = req.body;

    if (!usuario || !nombre || !password) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos obligatorios." });
    }

    try {
        // Encriptar la contraseña usando tu función existente
        const passwordHash = crearHash(password);

        const guardar = db.prepare(`
            INSERT INTO usuarios (usuario, nombre, password, rol, activo)
            VALUES (?, ?, ?, ?, 1)
        `);

        guardar.run(usuario, nombre, passwordHash, rol || "Tecnico");

        res.json({ ok: true, mensaje: "Usuario creado correctamente" });

    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(400).json({ ok: false, mensaje: "El nombre de usuario (login) ya existe." });
        }
        console.error(error);
        res.status(500).json({ ok: false, mensaje: "No se pudo crear el usuario" });
    }
});

// -----------------------------------------------------
// ELIMINAR / DESACTIVAR USUARIO
// -----------------------------------------------------
app.delete("/api/usuarios/:id", (req, res) => {
    if (req.session.usuario.rol !== "Administrador") {
        return res.status(403).json({ ok: false, mensaje: "Acceso denegado." });
    }

    // Evitar que el administrador se borre a sí mismo
    if (Number(req.params.id) === Number(req.session.usuario.id)) {
        return res.status(400).json({ ok: false, mensaje: "No puedes eliminar tu propio usuario." });
    }

    try {
        const resultado = db.prepare(`
            DELETE FROM usuarios WHERE id = ?
        `).run(req.params.id);

        if (resultado.changes === 0) {
            return res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
        }

        res.json({ ok: true, mensaje: "Usuario eliminado correctamente" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, mensaje: "Error al eliminar usuario" });
    }
});

// =====================================================
// MANEJO DE ERRORES DE MULTER
// =====================================================
app.use(
    (error, req, res, next) => {
        if (
            error instanceof multer.MulterError
        ) {
            console.error(
                "Error de fotografías:",
                error
            );

            return res.status(400).json({
                ok: false,
                mensaje:
                    `Error al subir fotografías: ${error.message}`
            });
        }

        if (
            error &&
            error.message ===
                "Solo se permiten fotografías."
        ) {
            return res.status(400).json({
                ok: false,
                mensaje:
                    error.message
            });
        }

        next(error);
    }
);

// =====================================================
// INICIAR OCRIS
// =====================================================
app.listen(
    PORT,
    () => {
        console.log(
            "================================"
        );
        console.log(
            "             OCRIS"
        );
        console.log(
            "================================"
        );
        console.log(
            `Servidor funcionando en: http://localhost:${PORT}`
        );
        console.log(
            "================================"
        );
        console.log(
            "Funciones activas:"
        );
        console.log(
            "✓ Login"
        );
        console.log(
            "✓ Mantenimientos"
        );
        console.log(
            "✓ Pendientes"
        );
        console.log(
            "✓ GPS"
        );
        console.log(
            "✓ Fotografías"
        );
        console.log(
            "✓ Informes PDF"
        );
        console.log(
            "✓ Equipos"
        );
        console.log(
            "✓ Gestión de Usuarios"
        );
        console.log(
            "================================"
        );
    }
);