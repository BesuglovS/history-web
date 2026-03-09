<?php
/**
 * API для загрузки файлов с вопросами
 * POST /api/admin/upload.php
 */

header('Content-Type: application/json; charset=utf-8');

define('DATA_DIR', __DIR__ . '/../../data');
define('QUESTIONS_DIR', DATA_DIR . '/questions');
define('UPLOADS_DIR', __DIR__ . '/../../uploads');

// Проверка авторизации
checkAuth();

try {
    // Создаём директории если не существуют
    if (!is_dir(QUESTIONS_DIR)) {
        mkdir(QUESTIONS_DIR, 0777, true);
    }
    if (!is_dir(UPLOADS_DIR)) {
        mkdir(UPLOADS_DIR, 0777, true);
    }
    
    // Проверяем, был ли загружен файл
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'Файл не загружен']);
        exit;
    }
    
    $file = $_FILES['file'];
    
    // Проверяем расширение
    if (pathinfo($file['name'], PATHINFO_EXTENSION) !== 'txt') {
        http_response_code(400);
        echo json_encode(['error' => 'Поддерживаются только текстовые файлы (.txt)']);
        exit;
    }
    
    // Читаем содержимое файла
    $text = file_get_contents($file['tmp_name']);
    
    // Парсим вопросы
    $parsed = parseQuestionsFile($text);
    
    if (count($parsed['questions']) === 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Не найдено ни одного вопроса в файле']);
        exit;
    }
    
    // Генерируем ID темы
    $topicId = transliterate($parsed['title']);
    $topicId = preg_replace('/[^a-zа-яё0-9]/ui', '_', $topicId);
    $topicId = preg_replace('/_+/', '_', $topicId);
    $topicId = mb_substr($topicId, 0, 50);
    $topicId = trim($topicId, '_');
    
    // Проверяем существование темы и добавляем суффикс если нужно
    $originalTopicId = $topicId;
    $suffix = 0;
    while (file_exists(QUESTIONS_DIR . '/' . $topicId . '.json')) {
        $suffix++;
        $topicId = $originalTopicId . '-' . $suffix;
    }
    
    // Формируем данные темы
    $topicData = [
        'id' => $topicId,
        'title' => $parsed['title'],
        'questions' => array_map(function($q, $i) {
            $q['id'] = $i + 1;
            return $q;
        }, $parsed['questions'], array_keys($parsed['questions']))
    ];
    
    // Сохраняем тему
    $filePath = QUESTIONS_DIR . '/' . $topicId . '.json';
    file_put_contents($filePath, json_encode($topicData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    // Удаляем временный файл
    unlink($file['tmp_name']);
    
    echo json_encode([
        'success' => true,
        'topic' => [
            'id' => $topicId,
            'title' => $parsed['title'],
            'questionCount' => count($parsed['questions'])
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка при обработке файла']);
}

/**
 * Парсинг текстового файла с вопросами
 */
function parseQuestionsFile($text) {
    $lines = array_filter(array_map('trim', explode("\n", $text)));
    $questions = [];
    $currentTopic = 'Новая тема';
    $currentQuestion = null;
    $currentState = 'topic';
    
    foreach ($lines as $line) {
        // Тема
        if (mb_strtoupper(mb_substr($line, 0, 5)) === 'ТЕМА:') {
            $currentTopic = trim(mb_substr($line, 5));
            continue;
        }
        
        // Вопрос
        if (mb_strtoupper(mb_substr($line, 0, 7)) === 'ВОПРОС:') {
            if ($currentQuestion && !empty($currentQuestion['text'])) {
                $questions[] = $currentQuestion;
            }
            $currentQuestion = [
                'id' => count($questions) + 1,
                'text' => trim(mb_substr($line, 7)),
                'type' => 'single',
                'options' => [],
                'answer' => []
            ];
            $currentState = 'options';
            continue;
        }
        
        // Ответ
        if (mb_strtoupper(mb_substr($line, 0, 6)) === 'ОТВЕТ:') {
            $answerText = trim(mb_substr($line, 6));
            
            // Проверяем, есть ли варианты ответа у вопроса
            $hasOptions = !empty($currentQuestion['options']);
            
            if ($hasOptions) {
                // Для вопросов с вариантами - парсим номера
                $nums = array_map(function($n) {
                    return intval(trim($n)) - 1;
                }, array_filter(explode(',', $answerText), 'is_numeric'));
                $currentQuestion['answer'] = $nums;
                
                // Определяем тип вопроса
                if (count($nums) > 1) {
                    $currentQuestion['type'] = 'multiple';
                }
            } else {
                // Для открытых вопросов - сохраняем текст ответа
                $currentQuestion['type'] = 'open';
                $currentQuestion['answer'] = [$answerText];
            }
            
            $questions[] = $currentQuestion;
            $currentQuestion = null;
            $currentState = 'question';
            continue;
        }
        
        // Варианты ответа (начинаются с цифры и точки)
        if (preg_match('/^(\d+)\.\s*(.+)$/u', $line, $matches) && $currentState === 'options') {
            $currentQuestion['options'][] = $matches[2];
            
            // Проверяем тип вопроса по формату
            if (mb_stripos($line, '(выберите') !== false || mb_stripos($line, '(несколько') !== false) {
                $currentQuestion['type'] = 'multiple';
            }
        }
    }
    
    // Добавляем последний вопрос если не добавлен
    if ($currentQuestion && !empty($currentQuestion['text']) && !empty($currentQuestion['answer'])) {
        $questions[] = $currentQuestion;
    }
    
    return [
        'title' => $currentTopic,
        'questions' => $questions
    ];
}

/**
 * Транслитерация для генерации ID
 */
function transliterate($text) {
    $translit = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd',
        'е' => 'e', 'ё' => 'e', 'ж' => 'zh', 'з' => 'z', 'и' => 'i',
        'й' => 'y', 'к' => 'k', 'л' => 'l', 'м' => 'm', 'н' => 'n',
        'о' => 'o', 'п' => 'p', 'р' => 'r', 'с' => 's', 'т' => 't',
        'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'c', 'ч' => 'ch',
        'ш' => 'sh', 'щ' => 'sch', 'ь' => '', 'ы' => 'y', 'ъ' => '',
        'э' => 'e', 'ю' => 'yu', 'я' => 'ya'
    ];
    
    $text = mb_strtolower($text);
    $result = '';
    
    for ($i = 0; $i < mb_strlen($text); $i++) {
        $char = mb_substr($text, $i, 1);
        if (isset($translit[$char])) {
            $result .= $translit[$char];
        } elseif (preg_match('/[a-z0-9]/', $char)) {
            $result .= $char;
        } else {
            $result .= '_';
        }
    }
    
    return $result;
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