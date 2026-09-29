<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Informe de Mantenimiento #<?php echo e($m->id); ?></title>
    <style>
        /* DejaVu Sans da soporte nativo a símbolos como Ω, ± y tildes */
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 11px; color: #1e293b; margin: 15px; }
        
        /* ESTILOS DEL NUEVO ENCABEZADO */
        .header-table { width: 100%; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; border-collapse: collapse; }
        .header-table td { vertical-align: middle; }
        .header-logo { width: 20%; text-align: left; }
        .header-logo img { max-height: 55px; /* Ajusta este valor si tu logo es muy grande o pequeño */ }
        .header-texto { width: 60%; text-align: center; }
        .header-texto h1 { color: #0284c7; margin: 0; font-size: 20px; text-transform: uppercase; }
        .header-texto p { margin: 3px 0 0 0; color: #64748b; font-size: 11px; font-weight: bold; }
        .header-espacio { width: 20%; } /* Sirve para centrar el texto correctamente */

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
                <?php
                    // Buscamos el logo en la carpeta public/img/logo.png
                    $rutaLogo = public_path('img/logo.png');
                    $logoBase64 = '';
                    if(file_exists($rutaLogo)) {
                        $extensionLogo = pathinfo($rutaLogo, PATHINFO_EXTENSION);
                        $logoBase64 = 'data:image/' . $extensionLogo . ';base64,' . base64_encode(file_get_contents($rutaLogo));
                    }
                ?>
                <?php if($logoBase64): ?>
                    <img src="<?php echo e($logoBase64); ?>" alt="Logo">
                <?php endif; ?>
            </td>
            <td class="header-texto">
                <h1>OCRIS</h1>
                <p>Mantenimiento de Redes de Media Tensión GOSSR</p>
            </td>
            <td class="header-espacio"></td>
        </tr>
    </table>

    <div class="titulo-informe">
        INFORME TÉCNICO DE MANTENIMIENTO #<?php echo e($m->id); ?>

    </div>

    <table class="grid">
        <tr>
            <td class="label">Fecha:</td>
            <td><?php echo e(date('d/m/Y', strtotime($m->fecha))); ?></td>
            <td class="label">Equipo / Placa:</td>
            <td><b><?php echo e($m->estructura); ?></b></td>
        </tr>
        <tr>
            <td class="label">Ubicación:</td>
            <td><?php echo e($m->ubicacion ?: 'No registrada'); ?></td>
            <td class="label">Tipo de Trabajo:</td>
            <td><?php echo e($m->tipo_mantenimiento); ?></td>
        </tr>
        <tr>
            <td class="label">Elemento:</td>
            <td><?php echo e($m->elemento); ?></td>
            <td class="label">Técnico:</td>
            <td><?php echo e($m->realizado_por ?: 'Sistema'); ?></td>
        </tr>
    </table>

    <div class="section-title">Trabajo Realizado</div>
    <div class="box"><?php echo nl2br(e($m->descripcion)); ?></div>

    <!-- SECCIÓN DE OBSERVACIONES AUTOMATIZADA -->
    <div class="section-title">Observaciones / Daños</div>
    <div class="box">
        <?php if(!empty(trim($m->observaciones ?? ''))): ?>
            <?php echo nl2br(e($m->observaciones)); ?>

        <?php else: ?>
            <span class="sin-obs">Sin observaciones técnicas ni anomalías reportadas durante la inspección.</span>
        <?php endif; ?>
    </div>

    <!-- MEDICIONES TÉCNICAS -->
    <?php
        $med = is_array($m->mediciones) ? $m->mediciones : json_decode($m->mediciones ?? '[]', true);
        $tipoMed = $med['tipo_equipo'] ?? '';
    ?>

    <?php if(!empty($med) && count($med) > 1): ?>
        <div class="section-title">Parámetros y Mediciones Técnicas (<?php echo e($tipoMed); ?>)</div>
        <table class="grid" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 10px;">
            <?php if($tipoMed === 'OCRIS'): ?>
                <tr>
                    <td class="label">Tensión AC Auxiliar:</td>
                    <td><b><?php echo e((isset($med['tension_ac']) && $med['tension_ac'] !== null && $med['tension_ac'] !== '') ? $med['tension_ac'] . ' V' : '—'); ?></b></td>
                    <td class="label">Tensión Mando Motor:</td>
                    <td><b><?php echo e((isset($med['tension_mando_motor']) && $med['tension_mando_motor'] !== null && $med['tension_mando_motor'] !== '') ? $med['tension_mando_motor'] . ' V' : '—'); ?></b></td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Sin Carga):</td>
                    <td><b><?php echo e((isset($med['tension_dc_sin_carga']) && $med['tension_dc_sin_carga'] !== null && $med['tension_dc_sin_carga'] !== '') ? $med['tension_dc_sin_carga'] . ' V' : '—'); ?></b></td>
                    <td class="label">Resist. Circuito Motor:</td>
                    <td><b><?php echo e((isset($med['resistencia_circuito_motor']) && $med['resistencia_circuito_motor'] !== null && $med['resistencia_circuito_motor'] !== '') ? $med['resistencia_circuito_motor'] . ' &Omega;' : '—'); ?></b></td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Con Carga):</td>
                    <td><b><?php echo e((isset($med['tension_dc_con_carga']) && $med['tension_dc_con_carga'] !== null && $med['tension_dc_con_carga'] !== '') ? $med['tension_dc_con_carga'] . ' V' : '—'); ?></b></td>
                    <td class="label">Fecha de Batería:</td>
                    <td><b><?php echo e(!empty($med['fecha_bateria']) ? date('d/m/Y', strtotime($med['fecha_bateria'])) : '—'); ?></b></td>
                </tr>
            <?php elseif($tipoMed === 'RECONECTADOR'): ?>
                <tr>
                    <td class="label">Tensión AC Auxiliar:</td>
                    <td><b><?php echo e((isset($med['tension_ac']) && $med['tension_ac'] !== null && $med['tension_ac'] !== '') ? $med['tension_ac'] . ' V' : '—'); ?></b></td>
                    <td class="label">Tensión de Disparo:</td>
                    <td><b><?php echo e((isset($med['tension_disparo']) && $med['tension_disparo'] !== null && $med['tension_disparo'] !== '') ? $med['tension_disparo'] . ' V' : '—'); ?></b></td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Sin Carga):</td>
                    <td><b><?php echo e((isset($med['tension_dc_sin_carga']) && $med['tension_dc_sin_carga'] !== null && $med['tension_dc_sin_carga'] !== '') ? $med['tension_dc_sin_carga'] . ' V' : '—'); ?></b></td>
                    <td class="label">Fecha de Batería:</td>
                    <td><b><?php echo e(!empty($med['fecha_bateria']) ? date('d/m/Y', strtotime($med['fecha_bateria'])) : '—'); ?></b></td>
                </tr>
                <tr>
                    <td class="label">Tensión DC (Con Carga):</td>
                    <td><b><?php echo e((isset($med['tension_dc_con_carga']) && $med['tension_dc_con_carga'] !== null && $med['tension_dc_con_carga'] !== '') ? $med['tension_dc_con_carga'] . ' V' : '—'); ?></b></td>
                    <td></td><td></td>
                </tr>
            <?php elseif($tipoMed === 'REGULADOR'): ?>
                <tr>
                    <td class="label">Tensión AC BT:</td>
                    <td><b><?php echo e((isset($med['tension_ac_bt']) && $med['tension_ac_bt'] !== null && $med['tension_ac_bt'] !== '') ? $med['tension_ac_bt'] . ' V' : '—'); ?></b></td>
                    <td class="label">Tensión Salida:</td>
                    <td><b><?php echo e((isset($med['tension_salida']) && $med['tension_salida'] !== null && $med['tension_salida'] !== '') ? $med['tension_salida'] . ' kV' : '—'); ?></b></td>
                </tr>
                <tr>
                    <td class="label">Tensión Entrada:</td>
                    <td><b><?php echo e((isset($med['tension_entrada']) && $med['tension_entrada'] !== null && $med['tension_entrada'] !== '') ? $med['tension_entrada'] . ' kV' : '—'); ?></b></td>
                    <td class="label">Corriente de Carga:</td>
                    <td><b><?php echo e((isset($med['corriente']) && $med['corriente'] !== null && $med['corriente'] !== '') ? $med['corriente'] . ' A' : '—'); ?></b></td>
                </tr>
                <tr>
                    <td class="label">Ajuste Directo:</td>
                    <td colspan="3">
                        Tensión: <b><?php echo e((isset($med['ajuste_directo']['tension']) && $med['ajuste_directo']['tension'] !== null) ? $med['ajuste_directo']['tension'] . ' V' : '—'); ?></b> | 
                        Banda: <b>&plusmn;<?php echo e((isset($med['ajuste_directo']['ancho_banda']) && $med['ajuste_directo']['ancho_banda'] !== null) ? $med['ajuste_directo']['ancho_banda'] . ' V' : '—'); ?></b> | 
                        Tiempo: <b><?php echo e((isset($med['ajuste_directo']['tiempo']) && $med['ajuste_directo']['tiempo'] !== null) ? $med['ajuste_directo']['tiempo'] . ' s' : '—'); ?></b>
                    </td>
                </tr>
                <tr>
                    <td class="label">Ajuste Inverso:</td>
                    <td colspan="3">
                        Tensión: <b><?php echo e((isset($med['ajuste_inverso']['tension']) && $med['ajuste_inverso']['tension'] !== null) ? $med['ajuste_inverso']['tension'] . ' V' : '—'); ?></b> | 
                        Banda: <b>&plusmn;<?php echo e((isset($med['ajuste_inverso']['ancho_banda']) && $med['ajuste_inverso']['ancho_banda'] !== null) ? $med['ajuste_inverso']['ancho_banda'] . ' V' : '—'); ?></b> | 
                        Tiempo: <b><?php echo e((isset($med['ajuste_inverso']['tiempo']) && $med['ajuste_inverso']['tiempo'] !== null) ? $med['ajuste_inverso']['tiempo'] . ' s' : '—'); ?></b>
                    </td>
                </tr>
                <tr>
                    <td class="label">¿Restringido?:</td>
                    <td><b><?php echo e($med['restringido'] ?? 'NO'); ?></b></td>
                    <td class="label">Toma Restringida:</td>
                    <td><b><?php echo e($med['toma_restringida'] ?? 'N/A'); ?></b></td>
                </tr>
            <?php endif; ?>
        </table>
    <?php endif; ?>

    <!-- PROTEGIDO CONTRA ERRORES PHP (VALORES NULOS) -->
    <?php if(strtoupper($m->tiene_pendiente ?? '') === 'SÍ' || strtoupper($m->tiene_pendiente ?? '') === 'SI'): ?>
        <div class="pendiente-box">
            <b>⚠️ TRABAJO PENDIENTE:</b><br>
            <?php echo nl2br(e($m->pendiente)); ?>

        </div>
    <?php endif; ?>

    <?php
        $listaFotos = is_array($m->fotos) ? $m->fotos : json_decode($m->fotos ?? '[]', true);
    ?>

    <?php if(!empty($listaFotos) && is_array($listaFotos) && count($listaFotos) > 0): ?>
        <div class="section-title">Evidencias Fotográficas</div>
        <table class="tabla-fotos">
            <?php $__currentLoopData = array_chunk($listaFotos, 2); $__env->addLoop($__currentLoopData); foreach($__currentLoopData as $filaFotos): $__env->incrementLoopIndices(); $loop = $__env->getLastLoop(); ?>
                <tr>
                    <?php $__currentLoopData = $filaFotos; $__env->addLoop($__currentLoopData); foreach($__currentLoopData as $foto): $__env->incrementLoopIndices(); $loop = $__env->getLastLoop(); ?>
                        <?php
                            $rutaFoto = storage_path('app/public/mantenimientos/' . $foto);
                        ?>
                        <td class="celda-foto">
                            <?php if(file_exists($rutaFoto)): ?>
                                <?php
                                    $extension = pathinfo($rutaFoto, PATHINFO_EXTENSION);
                                    $base64 = 'data:image/' . $extension . ';base64,' . base64_encode(file_get_contents($rutaFoto));
                                ?>
                                <img src="<?php echo e($base64); ?>" class="foto-img">
                            <?php else: ?>
                                <div style="color: #94a3b8; font-size: 10px; border: 1px dashed #cbd5e1; padding: 20px;">
                                    [Archivo <?php echo e($foto); ?> no encontrado en disco]
                                </div>
                            <?php endif; ?>
                        </td>
                    <?php endforeach; $__env->popLoop(); $loop = $__env->getLastLoop(); ?>
                    <?php if(count($filaFotos) == 1): ?>
                        <td class="celda-foto"></td>
                    <?php endif; ?>
                </tr>
            <?php endforeach; $__env->popLoop(); $loop = $__env->getLastLoop(); ?>
        </table>
    <?php endif; ?>
</body>
</html><?php /**PATH C:\laragon\www\ocris-laravel\resources\views/pdf/mantenimiento.blade.php ENDPATH**/ ?>