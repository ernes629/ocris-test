<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->json('mediciones')->nullable()->after('observaciones');
        });

        Schema::table('estructuras', function (Blueprint $table) {
            $table->string('nivel_tension')->nullable()->after('tipo'); // 10.5 kV, 24 kV, 36 kV
        });
    }

    public function down(): void
    {
        Schema::table('mantenimientos', function (Blueprint $table) {
            $table->dropColumn('mediciones');
        });

        Schema::table('estructuras', function (Blueprint $table) {
            $table->dropColumn('nivel_tension');
        });
    }
};