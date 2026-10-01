FROM php:8.3-cli

# 1. Instalar dependencias del sistema (SQLite, procesador de imágenes GD para fotos, zip)
RUN apt-get update && apt-get install -y \
    libsqlite3-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libzip-dev \
    zip \
    unzip \
    git \
    curl \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_sqlite gd zip

# 2. Descargar Composer oficial
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# 3. Copiar el código del proyecto
COPY . .

# 4. Instalar las dependencias de Laravel
RUN composer install --no-dev --optimize-autoloader --no-interaction

# 5. Crear las carpetas necesarias si no existen, crear la base de datos SQLite y asignar permisos
RUN mkdir -p /var/www/database \
             /var/www/storage/framework/sessions \
             /var/www/storage/framework/views \
             /var/www/storage/framework/cache \
             /var/www/storage/app/public/mantenimientos \
             /var/www/bootstrap/cache \
    && touch /var/www/database/database.sqlite \
    && chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache /var/www/database \
    && chmod -R 775 /var/www/storage /var/www/bootstrap/cache /var/www/database

# 6. Puerto dinámico de Render
ENV PORT=10000
EXPOSE 10000

# 7. Al arrancar: crea enlace de fotos, ejecuta migraciones, crea admin y arranca el servidor
CMD php artisan storage:link --quiet || true && \
    php artisan migrate --force && \
    php artisan db:seed --force && \
    php artisan serve --host=0.0.0.0 --port=${PORT:-10000}