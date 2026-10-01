<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('estructuras', function (Blueprint $table) {
            // Agregamos la columna después de "tipo". Es nullable por si hay equipos sin tensión.
            $table->string('nivel_tension')->nullable()->after('tipo');
        });
    }

    public function down()
    {
        Schema::table('estructuras', function (Blueprint $table) {
            $table->dropColumn('nivel_tension');
        });
    }
};