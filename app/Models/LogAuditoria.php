<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LogAuditoria extends Model
{
    use HasFactory;

    protected $table = 'log_auditorias';

    protected $fillable = [
        'usuario',
        'accion',
        'mantenimiento_id',
        'detalles',
    ];
}