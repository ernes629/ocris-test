<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('estructuras', function (Blueprint $table) {
            $table->id();
            $table->string('codigo')->unique(); // Placa en poste
            $table->string('tipo');             // OCRIS, Reconectador, Regulador, Varios
            $table->string('marca')->nullable();
            $table->string('modelo')->nullable();
            $table->string('numero_serie')->nullable();
            $table->date('fecha_instalacion')->nullable();
            $table->string('ubicacion')->nullable();
            $table->string('estado')->default('Operativo');
            $table->string('latitud')->nullable();
            $table->string('longitud')->nullable();
            $table->text('observaciones')->nullable();
            $table->integer('salud_porcentaje')->default(100);
            $table->string('criticidad')->default('Normal');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('estructuras');
    }
};
