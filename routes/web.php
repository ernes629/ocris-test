<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EstructuraController;
use App\Http\Controllers\MantenimientoController;
use App\Http\Controllers\PlanMantenimientoController;
use App\Http\Controllers\UsuarioController;
use App\Models\LogAuditoria;

// Servir la página de inicio y el login
Route::get('/', function () {
    return file_get_contents(public_path('index.html'));
});

Route::get('/login.html', function () {
    return file_get_contents(public_path('login.html'));
});

// Enlace compatible para las fotos existentes y nuevas
Route::get('/uploads/mantenimientos/{foto}', function ($foto) {
    $path = storage_path('app/public/mantenimientos/' . $foto);
    if (!file_exists($path)) {
        abort(404);
    }
    return response()->file($path);
});

// Rutas de Autenticación
Route::post('/api/login', [AuthController::class, 'login']);
Route::post('/api/logout', [AuthController::class, 'logout']);
Route::get('/api/usuario', [AuthController::class, 'me']);

// Rutas de Estructuras (Equipos)
Route::get('/api/estructuras', [EstructuraController::class, 'index']);
Route::post('/api/estructuras', [EstructuraController::class, 'store']);
Route::put('/api/estructuras/{id}', [EstructuraController::class, 'update']);
Route::delete('/api/estructuras/masivo', [EstructuraController::class, 'destroyMasivo']);
Route::delete('/api/estructuras/{id}', [EstructuraController::class, 'destroy']);

// Rutas de Mantenimientos
Route::get('/api/mantenimientos', [MantenimientoController::class, 'index']);
Route::post('/api/mantenimientos', [MantenimientoController::class, 'store']);
Route::put('/api/mantenimientos/{id}', [MantenimientoController::class, 'update']);
Route::delete('/api/mantenimientos/{id}', [MantenimientoController::class, 'destroy']);

// Rutas de Plan de Mantenimiento
Route::get('/api/plan', [PlanMantenimientoController::class, 'index']);
Route::post('/api/plan', [PlanMantenimientoController::class, 'store']);
Route::post('/api/plan/masivo', [PlanMantenimientoController::class, 'storeMasivo']);
Route::put('/api/plan/{id}/estado', [PlanMantenimientoController::class, 'cambiarEstado']);
Route::delete('/api/plan/lote', [PlanMantenimientoController::class, 'destroyLote']);
Route::delete('/api/plan/masivo', [PlanMantenimientoController::class, 'destroyMasivo']);
Route::delete('/api/plan/{id}', [PlanMantenimientoController::class, 'destroy']);

// Rutas de Usuarios y Logs
Route::get('/api/usuarios', [UsuarioController::class, 'index']);
Route::post('/api/usuarios', [UsuarioController::class, 'store']);
Route::put('/api/usuarios/{id}', [UsuarioController::class, 'update']);
Route::delete('/api/usuarios/{id}', [UsuarioController::class, 'destroy']);

Route::get('/api/logs', function () {
    return response()->json(LogAuditoria::orderBy('id', 'desc')->limit(100)->get());
});

// Descargar respaldo de base de datos SQLite
Route::get('/api/backup', function () {
    $dbPath = database_path('database.sqlite');
    return response()->download($dbPath, 'ocris_backup_' . date('Y-m-d') . '.sqlite');
});
//agrega ruta
Route::get('/api/mantenimientos/{id}/pdf', [MantenimientoController::class, 'pdf']);
//ruta migracion antigua
Route::post('/api/mantenimientos/migrar-antiguos', [MantenimientoController::class, 'migrarAntiguos']);