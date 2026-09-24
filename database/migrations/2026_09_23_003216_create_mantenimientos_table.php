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
        Schema::create('mantenimientos', function (Blueprint $table) {
            $table->id();
            $table->date('fecha');
            $table->string('estructura');       // Placa del equipo
            $table->string('ubicacion')->nullable();
            $table->string('tipo_mantenimiento'); // Preventivo, Correctivo, Inspección, Emergencia
            $table->string('elemento');
            $table->text('descripcion');
            $table->text('observaciones')->nullable();
            $table->string('realizado_por')->nullable();
            $table->string('tiene_pendiente')->default('No');
            $table->text('pendiente')->nullable();
            $table->string('latitud')->nullable();
            $table->string('longitud')->nullable();
            $table->json('fotos')->nullable();  // Almacena las rutas de las fotos como arreglo JSON
            $table->string('aislamiento_ohm')->nullable();
            $table->string('resistencia_contacto')->nullable();
            $table->string('accion_recomendada')->nullable();
            $table->string('causa_falla')->nullable();
            $table->integer('tiempo_inactividad')->nullable();
            $table->timestamps();
        });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mantenimientos');
    }
};
