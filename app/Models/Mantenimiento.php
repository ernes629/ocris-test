<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Mantenimiento extends Model
{
    use HasFactory;

    protected $table = 'mantenimientos';

    protected $fillable = [
        'fecha',
        'estructura',
        'ubicacion',
        'tipo_mantenimiento',
        'elemento',
        'descripcion',
        'observaciones',
        'mediciones',
        'realizado_por',
        'tiene_pendiente',
        'pendiente',
        'latitud',
        'longitud',
        'fotos',
        'aislamiento_ohm',
        'resistencia_contacto',
        'accion_recomendada',
        'causa_falla',
        'tiempo_inactividad',
    ];

    protected $casts = [
        'fotos' => 'array', // Transforma el JSON a un array de PHP automáticamente
    ];
}