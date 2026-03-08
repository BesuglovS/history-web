<?php
/**
 * API для получения вопросов по теме (без ответов)
 * GET /api/questions.php?topicId=xxx
 */

header('Content-Type: application/json; charset=utf-8');

define('DATA_DIR', __DIR__ . '/../data');
define('QUESTIONS_DIR', DATA_DIR . '/questions');

$topicId = isset($_GET['topicId']) ? $_GET['topicId'] : null;

if (!$topicId) {
    http_response_code(400);
    echo json_encode(['error' => 'Не указан ID темы']);
    exit;
}

$filePath = QUESTIONS_DIR . '/' . basename($topicId) . '.json';

if (!file_exists($filePath)) {
    http_response_code(404);
    echo json_encode(['error' => 'Тема не найдена']);
    exit;
}

try {
    $content = json_decode(file_get_contents($filePath), true);
    
    if (!$content) {
        http_response_code(500);
        echo json_encode(['error' => 'Ошибка при чтении файла темы']);
        exit;
    }
    
    // Скрываем правильные ответы
    $questions = array_map(function($q) {
        return [
            'id' => $q['id'],
            'text' => $q['text'],
            'type' => $q['type'],
            'options' => $q['options']
        ];
    }, $content['questions']);
    
    echo json_encode([
        'id' => $content['id'],
        'title' => $content['title'],
        'questions' => $questions
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка при чтении вопросов']);
}