<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class UsuarioController extends Controller
{
    public function index()
    {
        return response()->json(User::select('id', 'usuario', 'nombre', 'rol', 'activo', 'created_at as creado_en')->orderBy('id', 'desc')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'usuario' => 'required|unique:users,usuario',
            'nombre' => 'required',
            'password' => 'required',
        ]);

        User::create([
            'usuario' => $request->usuario,
            'nombre' => $request->nombre,
            'password' => $request->password,
            'rol' => $request->rol ?? 'Tecnico',
            'activo' => true,
        ]);

        return response()->json(['ok' => true, 'mensaje' => 'Usuario creado']);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $user->rol = $request->rol ?? $user->rol;

        if ($request->filled('password')) {
            $user->password = $request->password;
        }

        $user->save();
        return response()->json(['ok' => true, 'mensaje' => 'Usuario actualizado correctamente']);
    }

    public function destroy($id)
    {
        if (Auth::id() == $id) {
            return response()->json(['ok' => false, 'mensaje' => 'No puedes eliminarte a ti mismo'], 400);
        }

        User::findOrFail($id)->delete();
        return response()->json(['ok' => true, 'mensaje' => 'Usuario eliminado']);
    }
}