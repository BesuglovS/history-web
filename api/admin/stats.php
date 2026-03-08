<?php
/**
 * API для получения статистики
 * GET /api/admin/stats.php
 */

header('Content-Type: application/json; charset=utf-8');

define('DATA_DIR', __DIR__ . '/../../data');
define('QUESTIONS_DIR', DATA_DIR . '/questions');
define('RESULTS_DIR', DATA_DIR . '/results');

// Проверка авторизации
checkAuth();

try {
    $stats = [
        'totalSessions' => 0,
        'totalStudents' => 0,
        'totalTopics' => 0,
        'averageScore' => 0,
        'topicStats' => []
    ];
    
    // Подсчёт тем
    if (is_dir(QUESTIONS_DIR)) {
        $topicFiles = array_filter(scandir(QUESTIONS_DIR), function($f) {
            return pathinfo($f, PATHINFO_EXTENSION) === 'json';
        });
        $stats['totalTopics'] = count($topicFiles);
    }
    
    // Подсчёт результатов
    $totalScore = 0;
    $students = [];
    $topicStats = [];
    
    if (is_dir(RESULTS_DIR)) {
        $resultFiles = array_filter(scandir(RESULTS_DIR), function($f) {
            return pathinfo($f, PATHINFO_EXTENSION) === 'json';
        });
        
        foreach ($resultFiles as $file) {
            $content = json_decode(file_get_contents(RESULTS_DIR . '/' . $file), true);
            
            if ($content && isset($content['sessions'])) {
                foreach ($content['sessions'] as $session) {
                    $stats['totalSessions']++;
                    
                    // Подсчёт уникальных учеников
                    if (!empty($session['studentName']) && $session['studentName'] !== 'Аноним') {
                        $students[$session['studentName']] = true;
                    }
                    
                    // Подсчёт среднего балла
                    if ($session['total'] > 0) {
                        $totalScore += $session['score'] / $session['total'];
                    }
                    
                    // Статистика по темам
                    $topicId = $session['topicId'];
                    if (!isset($topicStats[$topicId])) {
                        $topicStats[$topicId] = [
                            'title' => $session['topicTitle'],
                            'attempts' => 0,
                            'avgScore' => 0,
                            'totalPercent' => 0
                        ];
                    }
                    
                    $topicStats[$topicId]['attempts']++;
                    if ($session['total'] > 0) {
                        $topicStats[$topicId]['totalPercent'] += ($session['score'] / $session['total']) * 100;
                    }
                }
            }
        }
    }
    
    // Вычисляем средние значения
    $stats['totalStudents'] = count($students);
    
    if ($stats['totalSessions'] > 0) {
        $stats['averageScore'] = round(($totalScore / $stats['totalSessions']) * 100);
    }
    
    // Вычисляем средние значения по темам
    foreach ($topicStats as $topicId => &$ts) {
        if ($ts['attempts'] > 0) {
            $ts['avgScore'] = round($ts['totalPercent'] / $ts['attempts']);
        }
    }
    
    $stats['topicStats'] = $topicStats;
    
    echo json_encode($stats);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Ошибка при получении статистики']);
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