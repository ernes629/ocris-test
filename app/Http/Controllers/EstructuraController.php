<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Estructura;
use App\Models\LogAuditoria; // <-- IMPORTANTE: Para guardar los logs
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class EstructuraController extends Controller
{
    public function index()
    {
        return response()->json(Estructura::orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        try {
            $datos = $request->all();
            
            // 🛡️ SEGURIDAD XSS: Limpiamos todos los campos de texto
            $camposTexto = ['codigo', 'tipo', 'marca', 'modelo', 'numero_serie', 'ubicacion', 'estado', 'latitud', 'longitud', 'observaciones', 'nivel_tension'];
            foreach ($camposTexto as $campo) {
                if (isset($datos[$campo])) {
                    $datos[$campo] = strip_tags($datos[$campo]);
                }
            }
            
            $estructura = Estructura::create($datos);

            // 📝 REGISTRAR EN EL LOG
            LogAuditoria::create([
                'usuario' => Auth::user()->usuario ?? 'Sistema',
                'accion' => 'CREACION EQUIPO',
                'detalles' => "Registró el equipo nuevo: " . $estructura->codigo
            ]);

            return response()->json(['ok' => true, 'id' => $estructura->id]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'mensaje' => 'Error al guardar el equipo'], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $estructura = Estructura::findOrFail($id);
            $datos = $request->all();
            
            // 🛡️ SEGURIDAD XSS: Limpiamos todos los campos de texto
            $camposTexto = ['codigo', 'tipo', 'marca', 'modelo', 'numero_serie', 'ubicacion', 'estado', 'latitud', 'longitud', 'observaciones', 'nivel_tension'];
            foreach ($camposTexto as $campo) {
                if (isset($datos[$campo])) {
                    $datos[$campo] = strip_tags($datos[$campo]);
                }
            }
            
            $estructura->update($datos);

            // 📝 REGISTRAR EN EL LOG
            LogAuditoria::create([
                'usuario' => Auth::user()->usuario ?? 'Sistema',
                'accion' => 'EDICION EQUIPO',
                'detalles' => "Editó la información del equipo: " . $estructura->codigo
            ]);

            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'mensaje' => 'Error al actualizar'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $estructura = Estructura::findOrFail($id);
            $codigo = $estructura->codigo;
            $estructura->delete();

            // 📝 REGISTRAR EN EL LOG
            LogAuditoria::create([
                'usuario' => Auth::user()->usuario ?? 'Sistema',
                'accion' => 'ELIMINACION EQUIPO',
                'detalles' => "Eliminó el equipo: " . $codigo
            ]);

            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false], 500);
        }
    }

    public function destroyMasivo()
    {
        try {
            Estructura::truncate();

            // 📝 REGISTRAR EN EL LOG
            LogAuditoria::create([
                'usuario' => Auth::user()->usuario ?? 'Sistema',
                'accion' => 'ELIMINACION MASIVA',
                'detalles' => "¡ALERTA! Vació por completo el inventario de equipos."
            ]);

            return response()->json(['ok' => true, 'mensaje' => 'Inventario borrado']);
        } catch (\Exception $e) {
            return response()->json(['ok' => false], 500);
        }
    }
}