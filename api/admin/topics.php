<?php
/**
 * API для управления темами (CRUD)
 * GET /api/admin/topics.php?id=xxx - получить тему с ответами
 * PUT /api/admin/topics.php?id=xxx - обновить тему
 * DELETE /api/admin/topics.php?id=xxx - удалить тему
 */

header('Content-Type: application/json; charset=utf-8');

define('DATA_DIR', __DIR__ . '/../../data');
define('QUESTIONS_DIR', DATA_DIR . '/questions');

// Проверка авторизации
checkAuth();

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            getTopic();
            break;
        case 'PUT':
            saveTopic();
            break;
        case 'DELETE':
            deleteTopic();
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Метод не поддерживается']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка сервера']);
}

/**
 * Получить тему с ответами
 */
function getTopic() {
    $topicId = isset($_GET['id']) ? $_GET['id'] : null;
    
    if (!$topicId) {
        http_response_code(400);
        echo json_encode(['error' => 'Не указан ID темы']);
        return;
    }
    
    $filePath = QUESTIONS_DIR . '/' . basename($topicId) . '.json';
    
    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Тема не найдена']);
        return;
    }
    
    $content = json_decode(file_get_contents($filePath), true);
    echo json_encode($content);
}

/**
 * Сохранить/обновить тему
 */
function saveTopic() {
    // Получаем ID из URL
    $topicId = isset($_GET['id']) ? $_GET['id'] : null;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Неверные данные']);
        return;
    }
    
    if (!$topicId) {
        http_response_code(400);
        echo json_encode(['error' => 'Не указан ID темы']);
        return;
    }
    
    $title = isset($input['title']) ? $input['title'] : '';
    $questions = isset($input['questions']) ? $input['questions'] : [];
    
    if (!$title) {
        http_response_code(400);
        echo json_encode(['error' => 'Не указано название темы']);
        return;
    }
    
    // Нумеруем вопросы
    $questions = array_map(function($q, $i) {
        $q['id'] = $i + 1;
        return $q;
    }, $questions, array_keys($questions));
    
    $topicData = [
        'id' => $topicId,
        'title' => $title,
        'questions' => $questions
    ];
    
    // Создаём директорию если не существует
    if (!is_dir(QUESTIONS_DIR)) {
        mkdir(QUESTIONS_DIR, 0777, true);
    }
    
    $filePath = QUESTIONS_DIR . '/' . basename($topicId) . '.json';
    file_put_contents($filePath, json_encode($topicData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    echo json_encode(['success' => true]);
}

/**
 * Удалить тему
 */
function deleteTopic() {
    $topicId = isset($_GET['id']) ? $_GET['id'] : null;
    
    if (!$topicId) {
        http_response_code(400);
        echo json_encode(['error' => 'Не указан ID темы']);
        return;
    }
    
    $filePath = QUESTIONS_DIR . '/' . basename($topicId) . '.json';
    
    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'Тема не найдена']);
        return;
    }
    
    unlink($filePath);
    echo json_encode(['success' => true]);
}

/**
 * Проверка авторизации
 */
function checkAuth() {
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    
    if ($authHeader === 'Bearer authenticated') {
        return true;
    }
    
    http_response_code(401);
    echo json_encode(['error' => 'Не авторизован']);
    exit;
}