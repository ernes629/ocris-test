<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Crea el usuario admin si no existe todavía
        if (!User::where('usuario', 'admin')->exists()) {
            User::create([
                'nombre' => 'Administrador',
                'usuario' => 'admin',
                'password' => 'admin123',
                'rol' => 'Administrador',
                'activo' => true,
            ]);
        }
    }
}