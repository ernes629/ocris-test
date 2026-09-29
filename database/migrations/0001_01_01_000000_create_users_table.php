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
        Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('nombre');
    $table->string('usuario')->unique();
    $table->string('password');
    $table->string('rol')->default('Tecnico');
    $table->boolean('activo')->default(true);
    $table->rememberToken();
    $table->timestamps();
});
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
