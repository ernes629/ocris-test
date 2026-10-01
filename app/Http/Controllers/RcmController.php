<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Mantenimiento;
use Carbon\Carbon;

class RcmController extends Controller
{
    public function diagnostico()
    {
        $mantenimientos = Mantenimiento::orderBy('fecha', 'desc')->get();
        
        $baterias = [];
        $motoresAlerta = [];
        $reguladoresAlerta = [];
        
        $conteoBaterias = ['total' => 0, 'criticas' => 0, 'alerta' => 0, 'normales' => 0];

        // Para calcular el Top 5
        $conteoFallas = [];

        foreach ($mantenimientos as $m) {
            // Contabilizar Correctivos/Emergencias para el Top 5 TPM
            $tipoM = strtoupper($m->tipo_mantenimiento ?? '');
            if ($tipoM === 'CORRECTIVO' || $tipoM === 'EMERGENCIA') {
                $fechaM = Carbon::parse($m->fecha);
                if ($fechaM->greaterThanOrEqualTo(now()->subMonths(12))) {
                    if (!isset($conteoFallas[$m->estructura])) {
                        $conteoFallas[$m->estructura] = 0;
                    }
                    $conteoFallas[$m->estructura]++;
                }
            }

            // Evitar procesar el mismo equipo dos veces para el estado actual (solo nos importa el último mtto)
            $placa = $m->estructura;
            
            $med = is_array($m->mediciones) ? $m->mediciones : json_decode($m->mediciones ?? '[]', true);
            $tipoEq = strtoupper($med['tipo_equipo'] ?? '');

            if (!empty($med)) {
                // ----------------------------------------------------
                // 1. ANÁLISIS DE BATERÍAS (NUEVAS REGLAS 12V / 24V)
                // ----------------------------------------------------
                if (!isset($baterias[$placa]) && isset($med['tension_dc_sin_carga'])) {
                    
                    $vSinCarga = floatval($med['tension_dc_sin_carga']);
                    $vConCarga = floatval($med['tension_dc_con_carga'] ?? 0);
                    $fechaBat = $med['fecha_bateria'] ?? null;
                    
                    $tipoBanco = ($vSinCarga > 15) ? 24 : 12;
                    $deltaV = ($vSinCarga > 0 && $vConCarga > 0) ? ($vSinCarga - $vConCarga) : 0;
                    
                    $criticas = [];
                    $alertas = [];

                    // Regla 1: Reposo
                    if ($tipoBanco === 24) {
                        if ($vSinCarga > 0 && $vSinCarga < 23.0) $criticas[] = "Reposo < 23V.";
                        elseif ($vSinCarga > 0 && $vSinCarga <= 25.0) $alertas[] = "Reposo bajo.";
                    } else {
                        if ($vSinCarga > 0 && $vSinCarga < 11.5) $criticas[] = "Reposo < 11.5V.";
                        elseif ($vSinCarga > 0 && $vSinCarga <= 12.5) $alertas[] = "Reposo bajo.";
                    }

                    // Regla 2: Bajo Carga
                    if ($vConCarga > 0) {
                        if ($tipoBanco === 24 && $vConCarga < 24.0) $criticas[] = "Carga < 24V.";
                        elseif ($tipoBanco === 12 && $vConCarga < 12.0) $criticas[] = "Carga < 12V.";
                    }

                    // Regla 3: Delta V
                    if ($vConCarga > 0) {
                        if ($tipoBanco === 24 && $deltaV > 3.0) $criticas[] = "ΔV > 3V.";
                        elseif ($tipoBanco === 12 && $deltaV > 2.0) $criticas[] = "ΔV > 2V.";
                    }

                    // Regla 4: Antigüedad
                    $edadAnos = 0;
                    if (!empty($fechaBat)) {
                        $edadAnos = Carbon::parse($fechaBat)->diffInDays(now()) / 365.25;
                        if ($edadAnos >= 5.0) $criticas[] = "Vida ≥ 5 años.";
                        elseif ($edadAnos >= 3.0) $alertas[] = "Vida ≥ 3 años.";
                    }

                    // Evaluación Final
                    if (count($criticas) > 0) {
                        $estado = 'CRITICA';
                        $diagnostico = "Reemplazo urgente: " . implode(" ", $criticas);
                        $conteoBaterias['criticas']++;
                    } elseif (count($alertas) > 0) {
                        $estado = 'ALERTA';
                        $diagnostico = "Monitorear: " . implode(" ", $alertas);
                        $conteoBaterias['alerta']++;
                    } else {
                        $estado = 'NORMAL';
                        $diagnostico = "Batería óptima.";
                        $conteoBaterias['normales']++;
                    }
                    $conteoBaterias['total']++;

                    $baterias[$placa] = [
                        'placa' => $placa,
                        'ubicacion' => $m->ubicacion ?? 'N/A',
                        'tipo_equipo' => $tipoEq,
                        'tipo_banco' => $tipoBanco . ' V',
                        'fecha_bateria' => $fechaBat ? Carbon::parse($fechaBat)->format('d/m/Y') : '—',
                        'antiguedad_anos' => number_format($edadAnos, 1),
                        'v_sin_carga' => $vSinCarga,
                        'v_con_carga' => $vConCarga ?: '—',
                        'delta_v' => $vConCarga > 0 ? number_format($deltaV, 2) : '—',
                        'estado' => $estado,
                        'diagnostico' => $diagnostico
                    ];
                }

                // ----------------------------------------------------
                // 2. ANÁLISIS DE MECANISMO MOTOR (R > 300)
                // ----------------------------------------------------
                if (!isset($motoresAlerta[$placa]) && isset($med['resistencia_circuito_motor'])) {
                    $rMotor = floatval($med['resistencia_circuito_motor']);
                    if ($rMotor > 300) {
                        $motoresAlerta[$placa] = [
                            'placa' => $placa,
                            'ubicacion' => $m->ubicacion ?? 'N/A',
                            'fecha' => Carbon::parse($m->fecha)->format('d/m/Y'),
                            'resistencia' => $rMotor . ' Ohm',
                            'tension_mando' => ($med['tension_mando_motor'] ?? '—') . ' V',
                            'diagnostico' => 'Resistencia muy alta. Riesgo de falla en apertura/cierre.'
                        ];
                    }
                }

                // ----------------------------------------------------
                // 3. ANÁLISIS DE REGULADORES RESTRINGIDOS
                // ----------------------------------------------------
                if (!isset($reguladoresAlerta[$placa]) && $tipoEq === 'REGULADOR') {
                    if (($med['restringido'] ?? 'NO') === 'SI') {
                        $reguladoresAlerta[$placa] = [
                            'placa' => $placa,
                            'ubicacion' => $m->ubicacion ?? 'N/A',
                            'toma_restringida' => $med['toma_restringida'] ?? 'N/A',
                            'tension_entrada' => ($med['tension_entrada'] ?? '—') . ' kV',
                            'tension_salida' => ($med['tension_salida'] ?? '—') . ' kV',
                            'corriente' => ($med['corriente'] ?? '—') . ' A',
                            'diagnostico' => 'El regulador tiene un bloqueo físico o lógico de tomas.'
                        ];
                    }
                }
            }
        }

        // Ordenar Top Fallados
        arsort($conteoFallas);
        $topProblematicos = [];
        $contador = 0;
        foreach ($conteoFallas as $pl => $fallas) {
            if ($contador >= 5) break;
            $topProblematicos[] = [
                'estructura' => $pl,
                'total_fallas' => $fallas
            ];
            $contador++;
        }

        return response()->json([
            'ok' => true,
            'conteo_baterias' => $conteoBaterias,
            'baterias' => array_values($baterias),
            'motores_alerta' => array_values($motoresAlerta),
            'reguladores_alerta' => array_values($reguladoresAlerta),
            'top_problematicos' => $topProblematicos
        ]);
    }
}