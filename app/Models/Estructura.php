<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Estructura extends Model
{
    use HasFactory;

    protected $table = 'estructuras';

    protected $fillable = [
        'codigo',
        'tipo',
        'nivel de tension',
        'marca',
        'modelo',
        'numero_serie',
        'fecha_instalacion',
        'ubicacion',
        'estado',
        'latitud',
        'longitud',
        'observaciones',
        'salud_porcentaje',
        'criticidad',
    ];
}