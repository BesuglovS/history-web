<?php
/**
 * API для получения списка тем
 * GET /api/topics.php
 */

header('Content-Type: application/json; charset=utf-8');

define('DATA_DIR', __DIR__ . '/../data');
define('QUESTIONS_DIR', DATA_DIR . '/questions');

try {
    if (!is_dir(QUESTIONS_DIR)) {
        mkdir(QUESTIONS_DIR, 0777, true);
    }
    
    $files = scandir(QUESTIONS_DIR);
    $topics = [];
    
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $content = json_decode(file_get_contents(QUESTIONS_DIR . '/' . $file), true);
            if ($content) {
                $topics[] = [
                    'id' => $content['id'],
                    'title' => $content['title'],
                    'questionCount' => isset($content['questions']) ? count($content['questions']) : 0
                ];
            }
        }
    }
    
    echo json_encode($topics);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка при чтении тем']);
}