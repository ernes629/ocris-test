<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $usuario = $request->input('usuario');
        $password = $request->input('password');

        if (!$usuario || !$password) {
            return response()->json(['ok' => false, 'mensaje' => 'Ingrese credenciales'], 400);
        }

        $user = User::where('usuario', $usuario)->where('activo', true)->first();

        // Verificamos si el usuario existe y la contraseña coincide
        if ($user && password_verify($password, $user->password)) {
            
            // 🛡️ SEGURIDAD: Previene ataques de "Fijación de Sesión"
            $request->session()->regenerate();
            
            Auth::login($user);
            
            session(['usuario' => [
                'id' => $user->id,
                'usuario' => $user->usuario,
                'nombre' => $user->nombre,
                'rol' => $user->rol
            ]]);

            return response()->json(['ok' => true]);
        }

        return response()->json(['ok' => false, 'mensaje' => 'Usuario o contraseña incorrectos'], 401);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request)
    {
        if (!Auth::check()) {
            return response()->json(['ok' => false], 401);
        }

        $user = Auth::user();
        return response()->json([
            'ok' => true,
            'usuario' => [
                'id' => $user->id,
                'usuario' => $user->usuario,
                'nombre' => $user->nombre,
                'rol' => $user->rol
            ]
        ]);
    }
}