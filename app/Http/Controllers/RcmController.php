<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Estructura;
use App\Models\Mantenimiento;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class RcmController extends Controller
{
    public function diagnostico()
    {
        $estructuras = Estructura::all();
        $hoy = Carbon::now();
        $haceUnAno = Carbon::now()->subYear();

        $baterias = [];
        $motoresAlerta = [];
        $reguladoresAlerta = [];
        $conteoBaterias = ['criticas' => 0, 'alerta' => 0, 'normales' => 0, 'total' => 0];

        foreach ($estructuras as $eq) {
            // Analiza el último mantenimiento registrado de cada equipo
            $ultimoMant = Mantenimiento::where('estructura', $eq->codigo)
                ->orderBy('fecha', 'desc')
                ->orderBy('id', 'desc')
                ->first();

            if (!$ultimoMant || empty($ultimoMant->mediciones)) {
                continue;
            }

            $med = is_array($ultimoMant->mediciones) 
                ? $ultimoMant->mediciones 
                : json_decode($ultimoMant->mediciones, true);

            if (!$med) continue;

            $tipoMed = strtoupper($med['tipo_equipo'] ?? $eq->tipo ?? '');

            // =========================================================
            // 1. DIAGNÓSTICO RCM DE BATERÍAS (OCRIS Y RECONECTADORES)
            // =========================================================
            if (str_contains($tipoMed, 'OCRI') || str_contains($tipoMed, 'RECONECTA') || str_contains($tipoMed, 'RV')) {
                $fechaBat = !empty($med['fecha_bateria']) ? Carbon::parse($med['fecha_bateria']) : null;
                $antiguedadAnos = $fechaBat ? round($fechaBat->diffInDays($hoy) / 365.25, 1) : null;

                $vSinCarga = (isset($med['tension_dc_sin_carga']) && is_numeric($med['tension_dc_sin_carga'])) ? floatval($med['tension_dc_sin_carga']) : null;
                $vConCarga = (isset($med['tension_dc_con_carga']) && is_numeric($med['tension_dc_con_carga'])) ? floatval($med['tension_dc_con_carga']) : null;
                $deltaV = ($vSinCarga !== null && $vConCarga !== null) ? round($vSinCarga - $vConCarga, 2) : null;

                // Detección automática del banco: 12V o 24V
                $tipoBanco = 24;
                if ($vSinCarga !== null && $vSinCarga < 18.0) {
                    $tipoBanco = 12;
                }

                $estadoBateria = 'NORMAL';
                $motivos = [];

                // Criterio 1: Antigüedad (>5 años crítica, 3 a 5 alerta, <3 normal)
                if ($antiguedadAnos !== null) {
                    if ($antiguedadAnos > 5.0) {
                        $estadoBateria = 'CRITICA';
                        $motivos[] = "Antigüedad crítica ({$antiguedadAnos} años > 5 años)";
                    } elseif ($antiguedadAnos >= 3.0) {
                        if ($estadoBateria !== 'CRITICA') $estadoBateria = 'ALERTA';
                        $motivos[] = "Antigüedad en alerta ({$antiguedadAnos} años)";
                    }
                }

                // Criterio 2: Caída bajo carga (Delta V > 3.0 V)
                if ($deltaV !== null && $deltaV > 3.0) {
                    $estadoBateria = 'CRITICA';
                    $motivos[] = "Caída excesiva bajo carga (ΔV = {$deltaV} V > 3.0 V) - Alta resistencia interna";
                }

                // Criterio 3: Salud Eléctrica por Nivel de Tensión
                if ($tipoBanco === 24) {
                    if (($vSinCarga !== null && $vSinCarga < 23.5) || ($vConCarga !== null && $vConCarga < 22.0)) {
                        $estadoBateria = 'CRITICA';
                        $motivos[] = "Tensión crítica 24V (Sin carga: {$vSinCarga}V, Con carga: {$vConCarga}V) - Riesgo de bloqueo";
                    } elseif ($vSinCarga !== null && $vSinCarga >= 24.0 && $vSinCarga <= 25.5) {
                        if ($estadoBateria !== 'CRITICA') $estadoBateria = 'ALERTA';
                        $motivos[] = "Tensión baja 24V ({$vSinCarga}V) - Posible falla de cargador o sulfatación";
                    }
                } else {
                    // Banco de 12 V
                    if (($vSinCarga !== null && $vSinCarga < 11.8) || ($vConCarga !== null && $vConCarga < 11.0)) {
                        $estadoBateria = 'CRITICA';
                        $motivos[] = "Tensión crítica 12V (Sin carga: {$vSinCarga}V, Con carga: {$vConCarga}V)";
                    } elseif ($vSinCarga !== null && $vSinCarga >= 12.0 && $vSinCarga <= 12.6) {
                        if ($estadoBateria !== 'CRITICA') $estadoBateria = 'ALERTA';
                        $motivos[] = "Tensión baja 12V ({$vSinCarga}V)";
                    }
                }

                if ($vSinCarga !== null || $antiguedadAnos !== null) {
                    $conteoBaterias['total']++;
                    if ($estadoBateria === 'CRITICA') $conteoBaterias['criticas']++;
                    elseif ($estadoBateria === 'ALERTA') $conteoBaterias['alerta']++;
                    else $conteoBaterias['normales']++;

                    $baterias[] = [
                        'equipo_id' => $eq->id,
                        'placa' => $eq->codigo,
                        'tipo_equipo' => $eq->tipo,
                        'ubicacion' => $eq->ubicacion ?: 'No registrada',
                        'ultimo_mantenimiento' => $ultimoMant->fecha,
                        'tipo_banco' => $tipoBanco . ' V',
                        'fecha_bateria' => $fechaBat ? $fechaBat->format('d/m/Y') : 'No registrada',
                        'antiguedad_anos' => $antiguedadAnos !== null ? $antiguedadAnos . ' años' : '—',
                        'v_sin_carga' => $vSinCarga !== null ? $vSinCarga . ' V' : '—',
                        'v_con_carga' => $vConCarga !== null ? $vConCarga . ' V' : '—',
                        'delta_v' => $deltaV !== null ? $deltaV . ' V' : '—',
                        'estado' => $estadoBateria,
                        'diagnostico' => count($motivos) > 0 ? implode(' | ', $motivos) : 'Condición óptima de flotación y servicio'
                    ];
                }

                // =========================================================
                // 2. SALUD DEL MECANISMO MOTOR EN OCRIS (> 300 Ω)
                // =========================================================
                if (str_contains($tipoMed, 'OCRI')) {
                    $rMotor = (isset($med['resistencia_circuito_motor']) && is_numeric($med['resistencia_circuito_motor'])) ? floatval($med['resistencia_circuito_motor']) : null;
                    if ($rMotor !== null && $rMotor > 300.0) {
                        $motoresAlerta[] = [
                            'placa' => $eq->codigo,
                            'ubicacion' => $eq->ubicacion ?: 'No registrada',
                            'resistencia' => $rMotor . ' Ω',
                            'tension_mando' => (!empty($med['tension_mando_motor'])) ? $med['tension_mando_motor'] . ' V' : '—',
                            'fecha' => $ultimoMant->fecha,
                            'diagnostico' => 'Resistencia elevada (> 300 Ω): Alerta de desgaste de escobillas, sulfatación de bornera o atasco mecánico en cruceta.'
                        ];
                    }
                }
            }

            // =========================================================
            // 3. REGULADORES RESTRINGIDOS / CALIDAD DE POTENCIA
            // =========================================================
            if (str_contains($tipoMed, 'REGULA') || str_contains($tipoMed, ' G')) {
                $restringido = strtoupper($med['restringido'] ?? 'NO');
                $toma = $med['toma_restringida'] ?? 'N/A';
                if ($restringido === 'SI') {
                    $reguladoresAlerta[] = [
                        'placa' => $eq->codigo,
                        'ubicacion' => $eq->ubicacion ?: 'No registrada',
                        'fecha' => $ultimoMant->fecha,
                        'toma_restringida' => $toma,
                        'tension_entrada' => (!empty($med['tension_entrada'])) ? $med['tension_entrada'] . ' kV' : '—',
                        'tension_salida' => (!empty($med['tension_salida'])) ? $med['tension_salida'] . ' kV' : '—',
                        'corriente' => (!empty($med['corriente'])) ? $med['corriente'] . ' A' : '—',
                        'diagnostico' => "Operación limitada en toma {$toma}. Indica perfil de tensión forzado o caída severa en el alimentador."
                    ];
                }
            }
        }

        // =========================================================
        // 4. RANKING TOP 5 EQUIPOS MÁS PROBLEMÁTICOS (ÚLTIMO AÑO)
        // =========================================================
        $topProblematicos = Mantenimiento::select('estructura', DB::raw('count(*) as total_fallas'))
            ->whereIn('tipo_mantenimiento', ['Correctivo', 'Emergencia'])
            ->where('fecha', '>=', $haceUnAno->format('Y-m-d'))
            ->groupBy('estructura')
            ->orderBy('total_fallas', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'ok' => true,
            'conteo_baterias' => $conteoBaterias,
            'baterias' => $baterias,
            'motores_alerta' => $motoresAlerta,
            'reguladores_alerta' => $reguladoresAlerta,
            'top_problematicos' => $topProblematicos,
        ]);
    }
}