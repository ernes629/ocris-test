<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Informe de Mantenimiento #{{ $m->id }}</title>
    <style>
        body { font-family: sans-serif; font-size: 12px; color: #1e293b; margin: 15px; }
        .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 15px; }
        .header h1 { color: #0284c7; margin: 0; font-size: 22px; text-transform: uppercase; }
        .header p { margin: 4px 0 0 0; color: #64748b; font-size: 12px; font-weight: bold; }
        .titulo-informe { font-size: 15px; font-weight: bold; margin-bottom: 12px; color: #0f172a; text-transform: uppercase; }
        .grid { width: 100%; margin-bottom: 10px; border-collapse: collapse; }
        .grid td { padding: 4px 6px; }
        .label { font-weight: bold; width: 22%; color: #475569; }
        .section-title { font-size: 12px; font-weight: bold; color: #0284c7; border-bottom: 1px solid #cbd5e1; margin-top: 12px; margin-bottom: 6px; padding-bottom: 3px; text-transform: uppercase; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; line-height: 1.4; }
        .pendiente-box { background: #fee2e2; border: 1px solid #ef4444; border-radius: 4px; padding: 8px 10px; color: #991b1b; margin-top: 8px; }
        .tabla-fotos { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .celda-foto { width: 50%; padding: 6px; text-align: center; vertical-align: middle; }
        .foto-img { max-width: 95%; max-height: 190px; border: 1px solid #cbd5e1; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>OCRIS</h1>
        <p>Mantenimiento de Redes de Media Tensión GOSSR</p>
    </div>

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
@php
        $med = is_array($m->mediciones) ? $m->mediciones : json_decode($m->mediciones ?? '[]', true);
        $tipoMed = $med['tipo_equipo'] ?? '';
    @endphp

    @if(!empty($med) && count($med) > 1)
        <div class="section-title">Parámetros y Mediciones Técnicas ({{ $tipoMed }})</div>
        <table class="grid" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px;">
            @if($tipoMed === 'OCRIS')
                <tr>
                    <td class="label">Tensión AC:</td><td>{{ $med['tension_ac'] ?? '—' }}</td>
                    <td class="label">Tensión Mando Motor:</td><td>{{ $med['tension_mando_motor'] ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Sin Carga):</td><td>{{ $med['tension_dc_sin_carga'] ?? '—' }}</td>
                    <td class="label">Resist. Circuito Motor:</td><td>{{ $med['resistencia_circuito_motor'] ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Con Carga):</td><td>{{ $med['tension_dc_con_carga'] ?? '—' }}</td>
                    <td class="label">Fecha de Batería:</td><td>{{ !empty($med['fecha_bateria']) ? date('d/m/Y', strtotime($med['fecha_bateria'])) : '—' }}</td>
                </tr>
            @elseif($tipoMed === 'RECONECTADOR')
                <tr>
                    <td class="label">Tensión AC:</td><td>{{ $med['tension_ac'] ?? '—' }}</td>
                    <td class="label">Tensión de Disparo:</td><td>{{ $med['tension_disparo'] ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Sin Carga):</td><td>{{ $med['tension_dc_sin_carga'] ?? '—' }}</td>
                    <td class="label">Fecha de Batería:</td><td>{{ !empty($med['fecha_bateria']) ? date('d/m/Y', strtotime($med['fecha_bateria'])) : '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Con Carga):</td><td>{{ $med['tension_dc_con_carga'] ?? '—' }}</td>
                    <td></td><td></td>
                </tr>
            @elseif($tipoMed === 'REGULADOR')
                <tr>
                    <td class="label">Tensión AC BT:</td><td>{{ $med['tension_ac_bt'] ?? '—' }}</td>
                    <td class="label">Tensión Salida:</td><td>{{ $med['tension_salida'] ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Tensión Entrada:</td><td>{{ $med['tension_entrada'] ?? '—' }}</td>
                    <td class="label">Corriente:</td><td>{{ $med['corriente'] ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Ajuste Directo:</td>
                    <td colspan="3">V: {{ $med['ajuste_directo']['tension'] ?? '—' }} | Banda: {{ $med['ajuste_directo']['ancho_banda'] ?? '—' }} | Tiempo: {{ $med['ajuste_directo']['tiempo'] ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">Ajuste Inverso:</td>
                    <td colspan="3">V: {{ $med['ajuste_inverso']['tension'] ?? '—' }} | Banda: {{ $med['ajuste_inverso']['ancho_banda'] ?? '—' }} | Tiempo: {{ $med['ajuste_inverso']['tiempo'] ?? '—' }}</td>
                </tr>
                <tr>
                    <td class="label">¿Restringido?:</td><td>{{ $med['restringido'] ?? 'NO' }}</td>
                    <td class="label">Toma Restringida:</td><td>{{ $med['toma_restringida'] ?? 'N/A' }}</td>
                </tr>
            @endif
        </table>
    @endif
    @if($m->observaciones)
        <div class="section-title">Observaciones / Daños</div>
        <div class="box">{!! nl2br(e($m->observaciones)) !!}</div>
    @endif

    @if(strtoupper($m->tiene_pendiente) === 'SÍ' || strtoupper($m->tiene_pendiente) === 'SI')
        <div class="pendiente-box">
            <b>⚠️ TRABAJO PENDIENTE:</b><br>
            {!! nl2br(e($m->pendiente)) !!}
        </div>
    @endif

    @php
        // Decodificación segura en array tanto si viene como texto JSON o como objeto
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