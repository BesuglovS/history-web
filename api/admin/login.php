<?php
/**
 * API для авторизации администратора
 * POST /api/admin/login.php
 */

header('Content-Type: application/json; charset=utf-8');

define('DATA_DIR', __DIR__ . '/../../data');
define('CONFIG_FILE', DATA_DIR . '/config.json');

// Получаем данные из тела запроса
$input = json_decode(file_get_contents('php://input'), true);

$password = isset($input['password']) ? $input['password'] : '';

if (!$password) {
    http_response_code(400);
    echo json_encode(['error' => 'Введите пароль']);
    exit;
}

try {
    if (!file_exists(CONFIG_FILE)) {
        http_response_code(500);
        echo json_encode(['error' => 'Файл конфигурации не найден']);
        exit;
    }
    
    $config = json_decode(file_get_contents(CONFIG_FILE), true);
    
    // Переопределение из переменных окружения (если задано)
    $adminPassword = getenv('ADMIN_PASSWORD') ?: (isset($config['adminPassword']) ? $config['adminPassword'] : '');
    
    if ($password === $adminPassword) {
        echo json_encode(['success' => true, 'token' => 'authenticated']);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Неверный пароль']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка сервера']);
}