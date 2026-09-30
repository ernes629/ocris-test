<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Informe de Mantenimiento #{{ $m->id }}</title>
    <style>
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #1e293b; margin: 15px; }
        
        /* ESTILOS DEL NUEVO ENCABEZADO */
        .header-table { width: 100%; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; border-collapse: collapse; }
        .header-table td { vertical-align: middle; }
        .header-logo { width: 20%; text-align: left; }
        .header-logo img { max-height: 55px; }
        .header-texto { width: 60%; text-align: center; }
        .header-texto h1 { color: #0284c7; margin: 0; font-size: 20px; text-transform: uppercase; }
        .header-texto p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: bold; }
        .header-espacio { width: 20%; } 

        .titulo-informe { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #0f172a; text-transform: uppercase; }
        .grid { width: 100%; margin-bottom: 8px; border-collapse: collapse; }
        .grid td { padding: 4px 6px; }
        .label { font-weight: bold; width: 24%; color: #475569; }
        .section-title { font-size: 11px; font-weight: bold; color: #0284c7; border-bottom: 1px solid #cbd5e1; margin-top: 10px; margin-bottom: 5px; padding-bottom: 2px; text-transform: uppercase; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 7px 10px; margin-bottom: 6px; line-height: 1.4; }
        .sin-obs { color: #64748b; font-style: italic; }
        .pendiente-box { background: #fee2e2; border: 1px solid #ef4444; border-radius: 4px; padding: 7px 10px; color: #991b1b; margin-top: 6px; }
        .tabla-fotos { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .celda-foto { width: 50%; padding: 5px; text-align: center; vertical-align: middle; }
        .foto-img { max-width: 95%; max-height: 180px; border: 1px solid #cbd5e1; border-radius: 4px; }
    </style>
</head>
<body>
    
    <!-- ENCABEZADO CON LOGO SEGURO EN BASE64 -->
    <table class="header-table">
        <tr>
            <td class="header-logo">
                @php
                    $rutaLogo = public_path('img/logo.png');
                    $logoBase64 = '';
                    if(file_exists($rutaLogo)) {
                        $extensionLogo = pathinfo($rutaLogo, PATHINFO_EXTENSION);
                        $logoBase64 = 'data:image/' . $extensionLogo . ';base64,' . base64_encode(file_get_contents($rutaLogo));
                    }
                @endphp
                @if($logoBase64)
                    <img src="{{ $logoBase64 }}" alt="Logo">
                @endif
            </td>
            <td class="header-texto">
                <h1>OCRIS</h1>
                <p>Mantenimiento de Redes de Media Tensión GOSSR</p>
            </td>
            <td class="header-espacio"></td>
        </tr>
    </table>

    <div class="titulo-informe">
        INFORME TÉCNICO DE MANTENIMIENTO #{{ $m->id }}
    </div>

    <table class="grid">
        <tr>
            <td class="label">Fecha:</td>
            <td>{{ date('d/m/Y', strtotime($m->fecha)) }}</td>
            <td class="label">Equipo / Placa:</td>
            <td><b>{{ $m->estructura }}</b></td>
        </tr>
        <tr>
            <td class="label">Ubicación:</td>
            <td>{{ $m->ubicacion ?: 'No registrada' }}</td>
            <td class="label">Tipo de Trabajo:</td>
            <td>{{ $m->tipo_mantenimiento }}</td>
        </tr>
        <tr>
            <td class="label">Elemento:</td>
            <td>{{ $m->elemento }}</td>
            <td class="label">Técnico:</td>
            <td>{{ $m->realizado_por ?: 'Sistema' }}</td>
        </tr>
    </table>

    <div class="section-title">Trabajo Realizado</div>
    <div class="box">{!! nl2br(e($m->descripcion)) !!}</div>

    <div class="section-title">Observaciones / Daños</div>
    <div class="box">
        @if(!empty(trim($m->observaciones ?? '')))
            {!! nl2br(e($m->observaciones)) !!}
        @else
            <span class="sin-obs">Sin observaciones técnicas ni anomalías reportadas durante la inspección.</span>
        @endif
    </div>

    <!-- MEDICIONES TÉCNICAS -->
    @php
        $med = is_array($m->mediciones) ? $m->mediciones : json_decode($m->mediciones ?? '[]', true);
        $tipoMed = $med['tipo_equipo'] ?? '';
    @endphp

    @if(!empty($med) && count($med) > 1)
        <div class="section-title">Parámetros y Mediciones Técnicas ({{ $tipoMed }})</div>
        <table class="grid" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 10px;">
            @if($tipoMed === 'OCRIS')
                <tr>
                    <td class="label">Tensión AC Auxiliar:</td>
                    <td><b>{{ (isset($med['tension_ac']) && $med['tension_ac'] !== null && $med['tension_ac'] !== '') ? $med['tension_ac'] . ' V' : '—' }}</b></td>
                    <td class="label">Tensión Mando Motor:</td>
                    <td><b>{{ (isset($med['tension_mando_motor']) && $med['tension_mando_motor'] !== null && $med['tension_mando_motor'] !== '') ? $med['tension_mando_motor'] . ' V' : '—' }}</b></td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Sin Carga):</td>
                    <td><b>{{ (isset($med['tension_dc_sin_carga']) && $med['tension_dc_sin_carga'] !== null && $med['tension_dc_sin_carga'] !== '') ? $med['tension_dc_sin_carga'] . ' V' : '—' }}</b></td>
                    <td class="label">Resist. Circuito Motor:</td>
                    <!-- CORRECCIÓN: Se cambió &Omega; por Ohm -->
                    <td><b>{{ (isset($med['resistencia_circuito_motor']) && $med['resistencia_circuito_motor'] !== null && $med['resistencia_circuito_motor'] !== '') ? $med['resistencia_circuito_motor'] . ' Ohm' : '—' }}</b></td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Con Carga):</td>
                    <td><b>{{ (isset($med['tension_dc_con_carga']) && $med['tension_dc_con_carga'] !== null && $med['tension_dc_con_carga'] !== '') ? $med['tension_dc_con_carga'] . ' V' : '—' }}</b></td>
                    <td class="label">Fecha de Batería:</td>
                    <td><b>{{ !empty($med['fecha_bateria']) ? date('d/m/Y', strtotime($med['fecha_bateria'])) : '—' }}</b></td>
                </tr>
            @elseif($tipoMed === 'RECONECTADOR')
                <tr>
                    <td class="label">Tensión AC Auxiliar:</td>
                    <td><b>{{ (isset($med['tension_ac']) && $med['tension_ac'] !== null && $med['tension_ac'] !== '') ? $med['tension_ac'] . ' V' : '—' }}</b></td>
                    <td class="label">Tensión de Disparo:</td>
                    <td><b>{{ (isset($med['tension_disparo']) && $med['tension_disparo'] !== null && $med['tension_disparo'] !== '') ? $med['tension_disparo'] . ' V' : '—' }}</b></td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Sin Carga):</td>
                    <td><b>{{ (isset($med['tension_dc_sin_carga']) && $med['tension_dc_sin_carga'] !== null && $med['tension_dc_sin_carga'] !== '') ? $med['tension_dc_sin_carga'] . ' V' : '—' }}</b></td>
                    <td class="label">Fecha de Batería:</td>
                    <td><b>{{ !empty($med['fecha_bateria']) ? date('d/m/Y', strtotime($med['fecha_bateria'])) : '—' }}</b></td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Con Carga):</td>
                    <td><b>{{ (isset($med['tension_dc_con_carga']) && $med['tension_dc_con_carga'] !== null && $med['tension_dc_con_carga'] !== '') ? $med['tension_dc_con_carga'] . ' V' : '—' }}</b></td>
                    <td></td><td></td>
                </tr>
            @elseif($tipoMed === 'REGULADOR')
                <tr>
                    <td class="label">Tensión AC BT:</td>
                    <td><b>{{ (isset($med['tension_ac_bt']) && $med['tension_ac_bt'] !== null && $med['tension_ac_bt'] !== '') ? $med['tension_ac_bt'] . ' V' : '—' }}</b></td>
                    <td class="label">Tensión Salida:</td>
                    <td><b>{{ (isset($med['tension_salida']) && $med['tension_salida'] !== null && $med['tension_salida'] !== '') ? $med['tension_salida'] . ' kV' : '—' }}</b></td>
                </tr>
                <tr>
                    <td class="label">Tensión Entrada:</td>
                    <td><b>{{ (isset($med['tension_entrada']) && $med['tension_entrada'] !== null && $med['tension_entrada'] !== '') ? $med['tension_entrada'] . ' kV' : '—' }}</b></td>
                    <td class="label">Corriente de Carga:</td>
                    <td><b>{{ (isset($med['corriente']) && $med['corriente'] !== null && $med['corriente'] !== '') ? $med['corriente'] . ' A' : '—' }}</b></td>
                </tr>
                <tr>
                    <td class="label">Ajuste Directo:</td>
                    <td colspan="3">
                        <!-- CORRECCIÓN: Se eliminó el símbolo &plusmn; de la banda -->
                        Tensión: <b>{{ (isset($med['ajuste_directo']['tension']) && $med['ajuste_directo']['tension'] !== null) ? $med['ajuste_directo']['tension'] . ' V' : '—' }}</b> | 
                        Banda: <b>{{ (isset($med['ajuste_directo']['ancho_banda']) && $med['ajuste_directo']['ancho_banda'] !== null) ? $med['ajuste_directo']['ancho_banda'] . ' V' : '—' }}</b> | 
                        Tiempo: <b>{{ (isset($med['ajuste_directo']['tiempo']) && $med['ajuste_directo']['tiempo'] !== null) ? $med['ajuste_directo']['tiempo'] . ' s' : '—' }}</b>
                    </td>
                </tr>
                <tr>
                    <td class="label">Ajuste Inverso:</td>
                    <td colspan="3">
                        <!-- CORRECCIÓN: Se eliminó el símbolo &plusmn; de la banda -->
                        Tensión: <b>{{ (isset($med['ajuste_inverso']['tension']) && $med['ajuste_inverso']['tension'] !== null) ? $med['ajuste_inverso']['tension'] . ' V' : '—' }}</b> | 
                        Banda: <b>{{ (isset($med['ajuste_inverso']['ancho_banda']) && $med['ajuste_inverso']['ancho_banda'] !== null) ? $med['ajuste_inverso']['ancho_banda'] . ' V' : '—' }}</b> | 
                        Tiempo: <b>{{ (isset($med['ajuste_inverso']['tiempo']) && $med['ajuste_inverso']['tiempo'] !== null) ? $med['ajuste_inverso']['tiempo'] . ' s' : '—' }}</b>
                    </td>
                </tr>
                <tr>
                    <td class="label">¿Restringido?:</td>
                    <td><b>{{ $med['restringido'] ?? 'NO' }}</b></td>
                    <td class="label">Toma Restringida:</td>
                    <td><b>{{ $med['toma_restringida'] ?? 'N/A' }}</b></td>
                </tr>
            @endif
        </table>
    @endif

    @if(strtoupper($m->tiene_pendiente ?? '') === 'SÍ' || strtoupper($m->tiene_pendiente ?? '') === 'SI')
        <div class="pendiente-box">
            <b>⚠️ TRABAJO PENDIENTE:</b><br>
            {!! nl2br(e($m->pendiente)) !!}
        </div>
    @endif

    @php
        $listaFotos = is_array($m->fotos) ? $m->fotos : json_decode($m->fotos ?? '[]', true);
    @endphp

    @if(!empty($listaFotos) && is_array($listaFotos) && count($listaFotos) > 0)
        <div class="section-title">Evidencias Fotográficas</div>
        <table class="tabla-fotos">
            @foreach(array_chunk($listaFotos, 2) as $filaFotos)
                <tr>
                    @foreach($filaFotos as $foto)
                        @php
                            $rutaFoto = storage_path('app/public/mantenimientos/' . $foto);
                        @endphp
                        <td class="celda-foto">
                            @if(file_exists($rutaFoto))
                                @php
                                    $extension = pathinfo($rutaFoto, PATHINFO_EXTENSION);
                                    $base64 = 'data:image/' . $extension . ';base64,' . base64_encode(file_get_contents($rutaFoto));
                                @endphp
                                <img src="{{ $base64 }}" class="foto-img">
                            @else
                                <div style="color: #94a3b8; font-size: 10px; border: 1px dashed #cbd5e1; padding: 20px;">
                                    [Archivo {{ $foto }} no encontrado en disco]
                                </div>
                            @endif
                        </td>
                    @endforeach
                    @if(count($filaFotos) == 1)
                        <td class="celda-foto"></td>
                    @endif
                </tr>
            @endforeach
        </table>
    @endif
</body>
</html>