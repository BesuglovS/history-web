<?php
/**
 * API для проверки ответов и сохранения результата
 * POST /api/submit.php
 */

header('Content-Type: application/json; charset=utf-8');

define('DATA_DIR', __DIR__ . '/../data');
define('QUESTIONS_DIR', DATA_DIR . '/questions');
define('RESULTS_DIR', DATA_DIR . '/results');

// Получаем данные из тела запроса
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Неверные данные запроса']);
    exit;
}

$topicId = isset($input['topicId']) ? $input['topicId'] : null;
$studentName = isset($input['studentName']) ? $input['studentName'] : 'Аноним';
$answers = isset($input['answers']) ? $input['answers'] : [];
$practiceMode = isset($input['practiceMode']) ? $input['practiceMode'] : false;

if (!$topicId || !is_array($answers)) {
    http_response_code(400);
    echo json_encode(['error' => 'Неверные данные запроса']);
    exit;
}

// Загружаем правильные ответы
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
    
    // Создаём карту вопросов для быстрого поиска
    $questionsMap = [];
    foreach ($content['questions'] as $q) {
        $questionsMap[$q['id']] = $q;
    }
    
    // Проверяем ответы
    $correctCount = 0;
    $results = [];
    
    foreach ($answers as $answer) {
        $questionId = $answer['questionId'];
        $selected = isset($answer['selected']) ? $answer['selected'] : [];
        $answerTime = isset($answer['answerTime']) ? $answer['answerTime'] : 0;
        
        $q = isset($questionsMap[$questionId]) ? $questionsMap[$questionId] : null;
        $isCorrect = false;
        
        if ($q && $selected) {
            if ($q['type'] === 'open') {
                // Для открытых вопросов - проверка без учёта регистра и пробелов
                $correct = isset($q['answer'][0]) ? mb_strtolower(trim($q['answer'][0])) : '';
                $given = isset($selected[0]) ? mb_strtolower(trim($selected[0])) : '';
                $isCorrect = ($correct === $given) && ($correct !== '');
            } else {
                // Для выбора - сравнение массивов чисел
                $correctArr = array_map('intval', $q['answer']);
                $userArr = array_map('intval', $selected);
                sort($correctArr);
                sort($userArr);
                $isCorrect = ($correctArr === $userArr);
            }
        }
        
        if ($isCorrect) {
            $correctCount++;
        }
        
        $results[] = [
            'questionId' => $questionId,
            'correct' => $isCorrect,
            'correctAnswer' => $q ? $q['answer'] : [],
            'userAnswer' => $selected,
            'answerTime' => $answerTime
        ];
    }
    
    $totalAnswered = count($answers);
    
    // Сохраняем результат только если это не режим практики
    if (!$practiceMode) {
        // Создаём директорию если не существует
        if (!is_dir(RESULTS_DIR)) {
            mkdir(RESULTS_DIR, 0777, true);
        }
        
        $today = date('Y-m-d');
        $resultFile = RESULTS_DIR . '/' . $today . '.json';
        
        // Загружаем существующие результаты или создаём новые
        $resultsData = ['sessions' => []];
        if (file_exists($resultFile)) {
            $existingData = json_decode(file_get_contents($resultFile), true);
            if ($existingData && isset($existingData['sessions'])) {
                $resultsData = $existingData;
            }
        }
        
        // Генерируем UUID
        $sessionId = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        
        $session = [
            'id' => $sessionId,
            'studentName' => $studentName,
            'date' => date('c'),
            'topicId' => $topicId,
            'topicTitle' => $content['title'],
            'answers' => $results,
            'score' => $correctCount,
            'total' => $totalAnswered
        ];
        
        $resultsData['sessions'][] = $session;
        file_put_contents($resultFile, json_encode($resultsData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    echo json_encode([
        'score' => $correctCount,
        'total' => $totalAnswered,
        'results' => $results
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка при сохранении результата']);
}