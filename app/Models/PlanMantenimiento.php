<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlanMantenimiento extends Model
{
    use HasFactory;

    protected $table = 'plan_mantenimientos';

    protected $fillable = [
        'anio',
        'mes',
        'placa',
        'tipo',
        'ejecutado_manual',
    ];

    protected $casts = [
        'ejecutado_manual' => 'boolean',
    ];
}