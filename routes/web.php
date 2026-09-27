<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EstructuraController;
use App\Http\Controllers\MantenimientoController;
use App\Http\Controllers\PlanMantenimientoController;
use App\Http\Controllers\UsuarioController;
use App\Models\LogAuditoria;

// Vistas Públicas
Route::get('/', fn() => file_get_contents(public_path('index.html')));
Route::get('/login.html', fn() => file_get_contents(public_path('login.html')));

// API Pública (Solo Login)
Route::post('/api/login', [AuthController::class, 'login'])->middleware('throttle:5,1'); // Max 5 intentos por minuto

// RUTAS PROTEGIDAS (Solo usuarios que hayan iniciado sesión)
Route::middleware('auth')->group(function () {
    
    // Auth & User info
    Route::post('/api/logout', [AuthController::class, 'logout']);
    Route::get('/api/usuario', [AuthController::class, 'me']);

    // Fotos de mantenimientos
    Route::get('/uploads/mantenimientos/{foto}', function ($foto) {
        $path = storage_path('app/public/mantenimientos/' . $foto);
        abort_if(!file_exists($path), 404);
        return response()->file($path);
    });

    // Mantenimientos y Estructuras (Acceso para Técnicos y Superiores)
    Route::get('/api/estructuras', [EstructuraController::class, 'index']);
    Route::post('/api/estructuras', [EstructuraController::class, 'store']);
    Route::put('/api/estructuras/{id}', [EstructuraController::class, 'update']);
    
    Route::get('/api/mantenimientos', [MantenimientoController::class, 'index']);
    Route::post('/api/mantenimientos', [MantenimientoController::class, 'store']);
    Route::put('/api/mantenimientos/{id}', [MantenimientoController::class, 'update']);
    Route::get('/api/mantenimientos/{id}/pdf', [MantenimientoController::class, 'pdf']);

    // Plan RCM
    Route::get('/api/plan', [PlanMantenimientoController::class, 'index']);
    Route::get('/api/rcm/diagnostico', [\App\Http\Controllers\RcmController::class, 'diagnostico']);

    // ==========================================
    // RUTAS CRÍTICAS (DEBEN SER VERIFICADAS SI ES ADMIN EN EL CONTROLADOR)
    // ==========================================
    Route::delete('/api/estructuras/masivo', [EstructuraController::class, 'destroyMasivo']);
    Route::delete('/api/estructuras/{id}', [EstructuraController::class, 'destroy']);
    
    Route::delete('/api/mantenimientos/{id}', [MantenimientoController::class, 'destroy']);
    Route::post('/api/mantenimientos/migrar-antiguos', [MantenimientoController::class, 'migrarAntiguos']);

    Route::post('/api/plan', [PlanMantenimientoController::class, 'store']);
    Route::post('/api/plan/masivo', [PlanMantenimientoController::class, 'storeMasivo']);
    Route::put('/api/plan/{id}/estado', [PlanMantenimientoController::class, 'cambiarEstado']);
    Route::delete('/api/plan/lote', [PlanMantenimientoController::class, 'destroyLote']);
    Route::delete('/api/plan/masivo', [PlanMantenimientoController::class, 'destroyMasivo']);
    Route::delete('/api/plan/{id}', [PlanMantenimientoController::class, 'destroy']);

    // Gestión de Usuarios y Logs
    Route::get('/api/usuarios', [UsuarioController::class, 'index']);
    Route::post('/api/usuarios', [UsuarioController::class, 'store']);
    Route::put('/api/usuarios/{id}', [UsuarioController::class, 'update']);
    Route::delete('/api/usuarios/{id}', [UsuarioController::class, 'destroy']);

    Route::get('/api/logs', fn() => response()->json(LogAuditoria::orderBy('id', 'desc')->limit(100)->get()));
    
    Route::get('/api/backup', function () {
        return response()->download(database_path('database.sqlite'), 'ocris_backup_' . date('Y-m-d') . '.sqlite');
    });
});