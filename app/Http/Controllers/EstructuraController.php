<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Estructura;
use Illuminate\Support\Facades\DB;

class EstructuraController extends Controller
{
    public function index()
    {
        return response()->json(Estructura::orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        try {
            $estructura = Estructura::create($request->all());
            return response()->json(['ok' => true, 'id' => $estructura->id]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'mensaje' => 'Error al guardar el equipo'], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            $estructura = Estructura::findOrFail($id);
            $estructura->update($request->all());
            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'mensaje' => 'Error al actualizar'], 500);
        }
    }

    public function destroy($id)
    {
        try {
            Estructura::findOrFail($id)->delete();
            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false], 500);
        }
    }

    public function destroyMasivo()
    {
        try {
            Estructura::truncate();
            return response()->json(['ok' => true, 'mensaje' => 'Inventario borrado']);
        } catch (\Exception $e) {
            return response()->json(['ok' => false], 500);
        }
    }
}