<?php
/**
 * API для получения всех результатов
 * GET /api/admin/results.php
 */

header('Content-Type: application/json; charset=utf-8');

define('DATA_DIR', __DIR__ . '/../../data');
define('RESULTS_DIR', DATA_DIR . '/results');

// Проверка авторизации
checkAuth();

try {
    if (!is_dir(RESULTS_DIR)) {
        mkdir(RESULTS_DIR, 0777, true);
    }
    
    $allSessions = [];
    $files = scandir(RESULTS_DIR);
    
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $content = json_decode(file_get_contents(RESULTS_DIR . '/' . $file), true);
            if ($content && isset($content['sessions'])) {
                $allSessions = array_merge($allSessions, $content['sessions']);
            }
        }
    }
    
    // Сортировка по дате (новые первые)
    usort($allSessions, function($a, $b) {
        return strtotime($b['date']) - strtotime($a['date']);
    });
    
    echo json_encode($allSessions);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка при чтении результатов']);
}

/**
 * Проверка авторизации
 */
function checkAuth() {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    // Проверяем разные форматы заголовка
    if ($authHeader === 'Bearer authenticated') {
        return true;
    }
    
    http_response_code(401);
    echo json_encode(['error' => 'Не авторизован']);
    exit;
}