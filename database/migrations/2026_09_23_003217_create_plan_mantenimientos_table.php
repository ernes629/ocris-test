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
        Schema::create('plan_mantenimientos', function (Blueprint $table) {
            $table->id();
            $table->integer('anio')->default(2026);
            $table->integer('mes');
            $table->string('placa');
            $table->string('tipo')->default('Varios');
            $table->boolean('ejecutado_manual')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plan_mantenimientos');
    }
};
