<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth; // <-- IMPORTANTE: Agregado para poder leer el rol del usuario en las rutas
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EstructuraController;
use App\Http\Controllers\MantenimientoController;
use App\Http\Controllers\PlanMantenimientoController;
use App\Http\Controllers\UsuarioController;
use App\Http\Controllers\RcmController;
use App\Models\LogAuditoria;

// ==========================================
// 1. RUTAS PÚBLICAS (No requieren sesión)
// ==========================================
Route::get('/', function () { return file_get_contents(public_path('index.html')); });
Route::get('/login.html', function () { return file_get_contents(public_path('login.html')); });
Route::post('/api/login', [AuthController::class, 'login'])->middleware('throttle:5,1'); // Bloquea tras 5 intentos fallidos

// Enlace de fotos 
Route::get('/uploads/mantenimientos/{foto}', function ($foto) {
    $path = storage_path('app/public/mantenimientos/' . $foto);
    if (!file_exists($path)) abort(404);
    return response()->file($path);
});

// ==========================================
// 2. RUTAS PROTEGIDAS (Solo usuarios logueados: Técnicos, Supervisores, Admin)
// ==========================================
Route::middleware('auth')->group(function () {
    
    // Sesión y Usuario
    Route::post('/api/logout', [AuthController::class, 'logout']);
    Route::get('/api/usuario', [AuthController::class, 'me']);

    // Mantenimientos
    Route::get('/api/mantenimientos', [MantenimientoController::class, 'index']);
    Route::post('/api/mantenimientos', [MantenimientoController::class, 'store']);
    Route::put('/api/mantenimientos/{id}', [MantenimientoController::class, 'update']);
    Route::get('/api/mantenimientos/{id}/pdf', [MantenimientoController::class, 'pdf']);

    // Estructuras (Equipos)
    Route::get('/api/estructuras', [EstructuraController::class, 'index']);
    Route::post('/api/estructuras', [EstructuraController::class, 'store']);
    Route::put('/api/estructuras/{id}', [EstructuraController::class, 'update']);

    // Plan y RCM
    Route::get('/api/plan', [PlanMantenimientoController::class, 'index']);
    Route::get('/api/rcm/diagnostico', [RcmController::class, 'diagnostico']);

    // ==========================================
    // 3. RUTAS CRÍTICAS (Restringidas internamente al Admin en los controladores)
    // ==========================================
    
    // Borrados de Equipos
    Route::delete('/api/estructuras/masivo', [EstructuraController::class, 'destroyMasivo']);
    Route::delete('/api/estructuras/{id}', [EstructuraController::class, 'destroy']);
    
    // Borrados de Mantenimientos y Migración
    Route::delete('/api/mantenimientos/{id}', [MantenimientoController::class, 'destroy']);
    Route::post('/api/mantenimientos/migrar-antiguos', [MantenimientoController::class, 'migrarAntiguos']);

    // Edición del Plan de Mantenimiento
    Route::post('/api/plan', [PlanMantenimientoController::class, 'store']);
    Route::post('/api/plan/masivo', [PlanMantenimientoController::class, 'storeMasivo']);
    Route::put('/api/plan/{id}/estado', [PlanMantenimientoController::class, 'cambiarEstado']);
    Route::delete('/api/plan/lote', [PlanMantenimientoController::class, 'destroyLote']);
    Route::delete('/api/plan/masivo', [PlanMantenimientoController::class, 'destroyMasivo']);
    Route::delete('/api/plan/{id}', [PlanMantenimientoController::class, 'destroy']);

    // Gestión de Usuarios
    Route::get('/api/usuarios', [UsuarioController::class, 'index']);
    Route::post('/api/usuarios', [UsuarioController::class, 'store']);
    Route::put('/api/usuarios/{id}', [UsuarioController::class, 'update']);
    Route::delete('/api/usuarios/{id}', [UsuarioController::class, 'destroy']);

    // ==========================================
    // 4. RUTAS SUPER ADMIN (Protegidas desde aquí para evitar Fuga de Datos)
    // ==========================================
    
    // Logs de Auditoría
    Route::get('/api/logs', function () {
        if (Auth::user()->rol !== 'Administrador') {
            return response()->json(['error' => 'Acceso denegado. Solo administradores.'], 403);
        }
        return response()->json(LogAuditoria::orderBy('id', 'desc')->limit(100)->get());
    });
    
    // Descarga de Base de Datos
    Route::get('/api/backup', function () {
        if (Auth::user()->rol !== 'Administrador') {
            abort(403, 'Acceso denegado. Solo administradores pueden descargar la base de datos.');
        }
        return response()->download(database_path('database.sqlite'), 'ocris_backup_' . date('Y-m-d') . '.sqlite');
    });
    // RUTA DE EMERGENCIA PARA LIMPIAR LA CACHÉ
Route::get('/limpiar-cache', function() {
    \Illuminate\Support\Facades\Artisan::call('optimize:clear');
    return "¡La caché de Laravel ha sido limpiada con éxito en Render!";
});

});
