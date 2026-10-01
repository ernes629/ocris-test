<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Mantenimiento;
use App\Models\LogAuditoria;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\Facade\Pdf;

class MantenimientoController extends Controller
{
    public function index()
    {
        $mantenimientos = Mantenimiento::orderBy('id', 'desc')->get();
        return response()->json($mantenimientos);
    }

    public function store(Request $request)
    {
        try {
            // 1. SEGURIDAD: Validar que los archivos sean realmente imágenes y no scripts ocultos
            $request->validate([
                'fotografias.*' => 'nullable|image|mimes:jpeg,png,jpg,webp,heic|max:5120',
            ]);

            $rutasFotos = [];

            // Detecta fotos vengan como fotografias o fotografias[]
            $archivos = $request->file('fotografias') ?: [];
            if (!is_array($archivos)) {
                $archivos = [$archivos];
            }

            foreach ($archivos as $archivo) {
                if ($archivo && $archivo->isValid()) {
                    $nombre = 'foto-' . time() . '-' . uniqid() . '.' . $archivo->getClientOriginalExtension();
                    $archivo->storeAs('mantenimientos', $nombre, 'public');
                    $rutasFotos[] = $nombre;
                }
            }

            $datos = $request->except(['fotografias']);
            $datos['fotos'] = $rutasFotos;
            $datos['realizado_por'] = Auth::user()->usuario ?? 'Sistema';

            // 2. SEGURIDAD: Limpiar textos de cualquier etiqueta HTML o script inyectado (XSS)
            $datos['descripcion'] = strip_tags($request->input('descripcion', ''));
            $datos['observaciones'] = strip_tags($request->input('observaciones', ''));
            $datos['pendiente'] = strip_tags($request->input('pendiente', ''));
            $datos['ubicacion'] = strip_tags($request->input('ubicacion', ''));

            $pendEx = strtoupper(strip_tags($request->input('tiene_pendiente', 'NO')));
            $datos['tiene_pendiente'] = ($pendEx === 'SÍ' || $pendEx === 'SI') ? 'Sí' : 'No';

            // Mediciones técnicas dinámicas
            if ($request->filled('mediciones')) {
                $med = $request->input('mediciones');
                $datos['mediciones'] = is_array($med) ? $med : json_decode($med, true);
            } else {
                $datos['mediciones'] = null;
            }

            $mantenimiento = Mantenimiento::create($datos);

            return response()->json(['ok' => true, 'id' => $mantenimiento->id]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            // Captura el error si intentan subir un archivo falso o mayor a 5MB
            return response()->json(['ok' => false, 'mensaje' => 'Error de seguridad: Formato de imagen no permitido o archivo muy pesado.'], 422);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'mensaje' => 'Error al guardar: ' . $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        try {
            // 1. SEGURIDAD: Validar imágenes al editar
            $request->validate([
                'fotografias.*' => 'nullable|image|mimes:jpeg,png,jpg,webp,heic|max:5120',
            ]);

            $mantenimiento = Mantenimiento::findOrFail($id);
            $fotosViejas = $mantenimiento->fotos ?? [];

            $fotosQueSeQuedan = json_decode($request->input('fotosRestantes', '[]'), true) ?: [];

            // Eliminar físicamente fotos desmarcadas
            $fotosParaBorrar = array_diff($fotosViejas, $fotosQueSeQuedan);
            foreach ($fotosParaBorrar as $foto) {
                Storage::disk('public')->delete('mantenimientos/' . $foto);
            }

            // Subir nuevas fotos si las hay
            $archivos = $request->file('fotografias') ?: [];
            if (!is_array($archivos)) {
                $archivos = [$archivos];
            }
            foreach ($archivos as $archivo) {
                if ($archivo && $archivo->isValid()) {
                    $nombre = 'foto-' . time() . '-' . uniqid() . '.' . $archivo->getClientOriginalExtension();
                    $archivo->storeAs('mantenimientos', $nombre, 'public');
                    $fotosQueSeQuedan[] = $nombre;
                }
            }

            $datos = $request->except(['fotografias', 'fotosRestantes']);
            $datos['fotos'] = array_values($fotosQueSeQuedan);

            // 2. SEGURIDAD: Limpiar textos al editar (XSS)
            if (isset($datos['descripcion'])) $datos['descripcion'] = strip_tags($datos['descripcion']);
            if (isset($datos['observaciones'])) $datos['observaciones'] = strip_tags($datos['observaciones']);
            if (isset($datos['pendiente'])) $datos['pendiente'] = strip_tags($datos['pendiente']);
            if (isset($datos['ubicacion'])) $datos['ubicacion'] = strip_tags($datos['ubicacion']);

            if ($request->has('tiene_pendiente')) {
                $pendEx = strtoupper(strip_tags($request->input('tiene_pendiente', 'NO')));
                $datos['tiene_pendiente'] = ($pendEx === 'SÍ' || $pendEx === 'SI') ? 'Sí' : 'No';
            }

            if ($request->filled('mediciones')) {
                $med = $request->input('mediciones');
                $datos['mediciones'] = is_array($med) ? $med : json_decode($med, true);
            }

            $mantenimiento->update($datos);

            LogAuditoria::create([
                'usuario' => Auth::user()->usuario ?? 'Sistema',
                'accion' => 'EDICION',
                'mantenimiento_id' => $id,
                'detalles' => 'Editó el registro de mantenimiento.'
            ]);

            return response()->json(['ok' => true, 'mensaje' => 'Mantenimiento actualizado']);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['ok' => false, 'mensaje' => 'Error de seguridad: Formato de imagen no permitido o archivo muy pesado.'], 422);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'mensaje' => 'Error al actualizar: ' . $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        try {
            $mantenimiento = Mantenimiento::findOrFail($id);
            
            if (!empty($mantenimiento->fotos)) {
                foreach ($mantenimiento->fotos as $foto) {
                    Storage::disk('public')->delete('mantenimientos/' . $foto);
                }
            }

            $mantenimiento->delete();

            LogAuditoria::create([
                'usuario' => Auth::user()->usuario ?? 'Sistema',
                'accion' => 'ELIMINACION',
                'mantenimiento_id' => $id,
                'detalles' => 'Eliminó el mantenimiento'
            ]);

            return response()->json(['ok' => true]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false], 500);
        }
    }

    public function pdf($id)
    {
        $m = Mantenimiento::findOrFail($id);
        $pdf = Pdf::loadView('pdf.mantenimiento', compact('m'));
        return $pdf->stream("informe-mantenimiento-{$m->id}.pdf");
    }

    public function migrarAntiguos(Request $request)
    {
        if (!Auth::check() || Auth::user()->rol !== 'Administrador') {
            return response()->json(['ok' => false, 'mensaje' => 'Acceso denegado: solo Administradores'], 403);
        }

        if (!$request->hasFile('archivo_db')) {
            return response()->json(['ok' => false, 'mensaje' => 'Seleccione el archivo ocris.db'], 400);
        }

        $tempPath = $request->file('archivo_db')->getRealPath();

        try {
            $dbAntigua = new \PDO('sqlite:' . $tempPath);
            $dbAntigua->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

            $stmt = $dbAntigua->query("SELECT * FROM mantenimientos");
            $mantenimientosAntiguos = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            $migrados = 0;
            $omitidos = 0;

            foreach ($mantenimientosAntiguos as $m) {
                if (Mantenimiento::where('id', $m['id'])->exists()) {
                    $omitidos++;
                    continue;
                }

                $fotos = [];
                if (!empty($m['fotos'])) {
                    $fotos = json_decode($m['fotos'], true) ?: [];
                }

                Mantenimiento::create([
                    'id' => $m['id'],
                    'fecha' => $m['fecha'] ?? date('Y-m-d'),
                    'estructura' => $m['estructura'] ?? 'N/A',
                    'ubicacion' => $m['ubicacion'] ?? null,
                    'tipo_mantenimiento' => $m['tipo_mantenimiento'] ?? 'Preventivo',
                    'elemento' => $m['elemento'] ?? 'General',
                    'descripcion' => $m['descripcion'] ?? '',
                    'observaciones' => $m['observaciones'] ?? null,
                    'realizado_por' => $m['realizado_por'] ?? 'Migración',
                    'tiene_pendiente' => $m['tiene_pendiente'] ?? 'No',
                    'pendiente' => $m['pendiente'] ?? null,
                    'latitud' => $m['latitud'] ?? null,
                    'longitud' => $m['longitud'] ?? null,
                    'fotos' => $fotos,
                    'aislamiento_ohm' => $m['aislamiento_ohm'] ?? null,
                    'resistencia_contacto' => $m['resistencia_contacto'] ?? null,
                    'causa_falla' => $m['causa_falla'] ?? null,
                    'tiempo_inactividad' => $m['tiempo_inactividad'] ?? null,
                ]);

                $migrados++;
            }

            return response()->json([
                'ok' => true,
                'mensaje' => "Migración exitosa: {$migrados} mantenimientos importados ({$omitidos} omitidos por ya existir)."
            ]);
        } catch (\Exception $e) {
            return response()->json(['ok' => false, 'mensaje' => 'Error al leer la base de datos antigua: ' . $e->getMessage()], 500);
        }
    }
}