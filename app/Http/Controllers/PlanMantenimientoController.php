<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\PlanMantenimiento;

class PlanMantenimientoController extends Controller
{
    public function index()
    {
        $plan = PlanMantenimiento::orderBy('anio', 'asc')
            ->orderBy('mes', 'asc')
            ->orderBy('id', 'desc')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'año' => $item->anio,
                    'mes' => $item->mes,
                    'placa' => $item->placa,
                    'tipo' => $item->tipo,
                    'ejecutado_manual' => $item->ejecutado_manual ? 1 : 0
                ];
            });

        return response()->json($plan);
    }

    public function store(Request $request)
    {
        $item = PlanMantenimiento::create([
            'anio' => $request->input('año', 2026),
            'mes' => $request->input('mes'),
            'placa' => $request->input('placa'),
            'tipo' => $request->input('tipo', 'Varios'),
            'ejecutado_manual' => $request->boolean('ejecutado_manual', false),
        ]);

        return response()->json(['ok' => true, 'id' => $item->id]);
    }

    public function storeMasivo(Request $request)
    {
        $equipos = $request->input('equipos', []);
        foreach ($equipos as $eq) {
            PlanMantenimiento::create([
                'anio' => $eq['año'] ?? 2026,
                'mes' => $eq['mes'],
                'placa' => $eq['placa'],
                'tipo' => $eq['tipo'] ?? 'Varios',
                'ejecutado_manual' => !empty($eq['ejecutado_manual']),
            ]);
        }

        return response()->json(['ok' => true]);
    }

    public function cambiarEstado(Request $request, $id)
    {
        $item = PlanMantenimiento::findOrFail($id);
        $item->ejecutado_manual = $request->boolean('ejecutado');
        $item->save();

        return response()->json(['ok' => true]);
    }

    public function destroyLote(Request $request)
    {
        $ids = $request->input('ids', []);
        PlanMantenimiento::whereIn('id', $ids)->delete();
        return response()->json(['ok' => true]);
    }

    public function destroyMasivo()
    {
        PlanMantenimiento::truncate();
        return response()->json(['ok' => true]);
    }

    public function destroy($id)
    {
        PlanMantenimiento::findOrFail($id)->delete();
        return response()->json(['ok' => true]);
    }
}