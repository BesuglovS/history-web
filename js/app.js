// Состояние приложения
let currentTopic = null;
let allQuestions = [];
let questions = [];
let answers = {};
let currentMode = null; // 'practice' или 'test'
let currentQuestionIndex = 0;
let testResults = [];
let shuffledOptions = {}; // Маппинг перемешанных вариантов: questionId -> [{originalIndex, shuffledIndex}]
let currentPracticeQuestion = null; // Текущий вопрос в режиме практики
let practiceAnswered = 0; // Количество отвеченных вопросов в практике
let questionStartTime = null; // Время начала показа текущего вопроса
let testStartTime = null; // Время начала теста

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  loadTopics();

  // Сохранение результатов при закрытии вкладки в режиме практики
  window.addEventListener("beforeunload", (e) => {
    if (currentMode === "practice" && testResults.length > 0) {
      // Используем sendBeacon для надёжной отправки данных при закрытии
      const studentName = document.getElementById("studentName").value.trim();
      const answersArray = testResults.map((result) => ({
        questionId: result.questionId,
        selected: result.userAnswer,
      }));

      const data = {
        topicId: currentTopic.id,
        studentName: studentName,
        answers: answersArray,
        practiceMode: false,
      };

      // sendBeacon отправляет данные асинхронно даже при закрытии страницы
      navigator.sendBeacon(
        "/api/submit.php",
        new Blob([JSON.stringify(data)], { type: "application/json" }),
      );
    }
  });
});

// Загрузка списка тем
async function loadTopics() {
  try {
    const response = await fetch("/api/topics.php");
    const topics = await response.json();

    const topicsList = document.getElementById("topicsList");
    const noTopics = document.getElementById("noTopics");

    topicsList.innerHTML = "";

    if (topics.length === 0) {
      noTopics.classList.remove("hidden");
      return;
    }

    noTopics.classList.add("hidden");

    topics.forEach((topic) => {
      const icons = ["📜", "⚔️", "👑", "🏰", "🗺️", "🎭", "⚓", "🛡️"];
      const icon = icons[Math.floor(Math.random() * icons.length)];

      const topicEl = document.createElement("div");
      topicEl.className = "topic-item";
      topicEl.onclick = () => selectTopic(topic.id);

      topicEl.innerHTML = `
        <span class="icon">${icon}</span>
        <div class="info">
          <div class="title">${topic.title}</div>
          <div class="count">${topic.questionCount} вопросов</div>
        </div>
        <span class="arrow">→</span>
      `;

      topicsList.appendChild(topicEl);
    });
  } catch (error) {
    console.error("Ошибка загрузки тем:", error);
    alert("Не удалось загрузить темы. Попробуйте позже.");
  }
}

// Выбор темы
async function selectTopic(topicId) {
  try {
    const response = await fetch(`/api/questions.php?topicId=${topicId}`);
    if (!response.ok) {
      throw new Error("Тема не найдена");
    }

    const data = await response.json();
    currentTopic = data;
    allQuestions = data.questions;
    answers = {};
    testResults = [];
    currentQuestionIndex = 0;

    // Показываем экран выбора режима
    showModeScreen();
  } catch (error) {
    console.error("Ошибка загрузки вопросов:", error);
    alert("Не удалось загрузить вопросы. Попробуйте позже.");
  }
}

// Показать экран выбора режима
function showModeScreen() {
  document.getElementById("topicsScreen").classList.add("hidden");
  document.getElementById("modeScreen").classList.remove("hidden");
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultsScreen").classList.add("hidden");
}

// Показать экран выбора темы
function showTopics() {
  document.getElementById("topicsScreen").classList.remove("hidden");
  document.getElementById("modeScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultsScreen").classList.add("hidden");

  currentTopic = null;
  allQuestions = [];
  questions = [];
  answers = {};
  testResults = [];
  currentQuestionIndex = 0;
  currentMode = null;
}

// Начать выбранный режим
function startMode(mode) {
  currentMode = mode;
  currentQuestionIndex = 0;
  answers = {};
  testResults = [];
  shuffledOptions = {}; // Сбрасываем маппинг вариантов
  practiceAnswered = 0; // Сбрасываем счётчик практики
  testStartTime = Date.now(); // Время начала теста
  questionStartTime = Date.now(); // Время начала первого вопроса

  if (mode === "test") {
    // Выбираем фиксированное количество вопросов
    const count = parseInt(document.getElementById("questionCount").value);
    questions = shuffleArray([...allQuestions]).slice(0, count);

    // Перемешиваем варианты ответов для каждого вопроса
    questions.forEach((q) => {
      if (q.type !== "open" && q.options) {
        shuffledOptions[q.id] = createShuffledOptionsMapping(q.options.length);
      }
    });
  }
  // В практике не создаём заранее список вопросов - они выбираются случайно

  showQuizScreen();
}

// Создаём маппинг для перемешанных вариантов
function createShuffledOptionsMapping(count) {
  // Создаём массив индексов [0, 1, 2, ...]
  const indices = Array.from({ length: count }, (_, i) => i);
  // Перемешиваем
  const shuffled = shuffleArray([...indices]);
  // Возвращаем маппинг: shuffledIndex -> originalIndex
  return shuffled.map((originalIdx, shuffledIdx) => ({
    shuffled: shuffledIdx,
    original: originalIdx,
  }));
}

// Получить оригинальный индекс из перемешанного
function getOriginalIndex(questionId, shuffledIdx) {
  const mapping = shuffledOptions[questionId];
  if (!mapping) return shuffledIdx;
  const item = mapping.find((m) => m.shuffled === shuffledIdx);
  return item ? item.original : shuffledIdx;
}

// Получить перемешанный индекс из оригинального
function getShuffledIndex(questionId, originalIdx) {
  const mapping = shuffledOptions[questionId];
  if (!mapping) return originalIdx;
  const item = mapping.find((m) => m.original === originalIdx);
  return item ? item.shuffled : originalIdx;
}

// Перемешивание массива
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Показать экран тестирования
function showQuizScreen() {
  document.getElementById("modeScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.remove("hidden");

  if (currentMode === "practice") {
    renderSingleQuestion();
  } else {
    renderAllQuestions();
  }
  updateProgress();
}

// Рендер одного вопроса (режим практики)
function renderSingleQuestion() {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = "";

  // Выбираем случайный вопрос
  const randomIndex = Math.floor(Math.random() * allQuestions.length);
  currentPracticeQuestion = allQuestions[randomIndex];
  const q = currentPracticeQuestion;
  questionStartTime = Date.now();

  // Создаём маппинг для перемешанных вариантов
  if (q.type !== "open" && q.options) {
    shuffledOptions[q.id] = createShuffledOptionsMapping(q.options.length);
  }

  const questionEl = document.createElement("div");
  questionEl.className = "question-card";

  let optionsHtml = "";
  if (q.type === "open") {
    optionsHtml = `
      <div class="open-answer">
        <input 
          type="text" 
          class="form-control" 
          id="openAnswer-${q.id}"
          placeholder="Введите ваш ответ"
        >
      </div>
    `;
  } else {
    const isMultiple = q.type === "multiple";
    const mapping = shuffledOptions[q.id] || [];

    optionsHtml = '<div class="options-list">';
    mapping.forEach((item) => {
      const letter = String.fromCharCode(65 + item.shuffled);
      const opt = q.options[item.original];
      optionsHtml += `
        <div 
          class="option-item ${isMultiple ? "multiple" : ""}" 
          data-question="${q.id}" 
          data-original="${item.original}"
          onclick="selectPracticeOption(${q.id}, ${item.original}, ${isMultiple})"
        >
          <span class="option-marker">${letter}</span>
          <span class="option-text">${opt}</span>
        </div>
      `;
    });
    optionsHtml += "</div>";
  }

  questionEl.innerHTML = `
    <span class="question-number">Вопрос</span>
    <p class="question-text">${q.text}</p>
    ${optionsHtml}
    <div id="feedbackArea" class="hidden" style="margin-top: 20px;"></div>
  `;

  container.appendChild(questionEl);

  // Показываем кнопку "Проверить ответ"
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.textContent = "✅ Проверить ответ";
  submitBtn.onclick = checkPracticeAnswer;

  // Скрываем область обратной связи
  document.getElementById("feedbackArea").classList.add("hidden");
}

// Выбор варианта в режиме практики
function selectPracticeOption(questionId, optionIndex, isMultiple) {
  if (isMultiple) {
    const item = document.querySelector(
      `[data-question="${questionId}"][data-original="${optionIndex}"]`,
    );
    item.classList.toggle("selected");
  } else {
    const items = document.querySelectorAll(`[data-question="${questionId}"]`);
    items.forEach((item) => item.classList.remove("selected"));
    document
      .querySelector(
        `[data-question="${questionId}"][data-original="${optionIndex}"]`,
      )
      .classList.add("selected");
  }
}

// Проверка ответа в режиме практики
async function checkPracticeAnswer() {
  const q = currentPracticeQuestion;
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;

  // Вычисляем время ответа
  const answerTime = Date.now() - questionStartTime;

  // Собираем ответ пользователя
  let userAnswer = [];
  if (q.type === "open") {
    const input = document.getElementById(`openAnswer-${q.id}`);
    userAnswer = [input.value.trim()];
  } else {
    const selected = document.querySelectorAll(
      `[data-question="${q.id}"].selected`,
    );
    selected.forEach((item) => {
      userAnswer.push(parseInt(item.dataset.original));
    });
  }

  if (userAnswer.length === 0 || (q.type === "open" && !userAnswer[0])) {
    alert("Выберите или введите ответ");
    submitBtn.disabled = false;
    return;
  }

  try {
    const response = await fetch("/api/submit.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicId: currentTopic.id,
        studentName:
          document.getElementById("studentName").value.trim() || "Аноним",
        answers: [
          {
            questionId: q.id,
            selected: userAnswer,
            answerTime: answerTime,
          },
        ],
        practiceMode: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Ошибка сервера");
    }

    const result = await response.json();

    // Находим результат для конкретного вопроса
    const resultForQuestion = result.results.find((r) => r.questionId === q.id);
    if (!resultForQuestion) {
      throw new Error("Результат для вопроса не найден");
    }

    const isCorrect = resultForQuestion.correct;
    const correctAnswer = resultForQuestion.correctAnswer;

    // Показываем результат
    showPracticeFeedback(isCorrect, correctAnswer, userAnswer, q.id);

    // Сохраняем результат с самим вопросом и временем
    testResults.push({
      questionId: q.id,
      question: currentPracticeQuestion,
      correct: isCorrect,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer,
      answerTime: answerTime, // Время в миллисекундах
    });
  } catch (error) {
    console.error("Ошибка:", error);
    alert("Не удалось проверить ответ. Попробуйте позже.");
  } finally {
    submitBtn.disabled = false;
    updatePracticeButtons();
  }
}

// Показать обратную связь в режиме практики
function showPracticeFeedback(
  isCorrect,
  correctAnswer,
  userAnswer,
  questionId,
) {
  const feedbackArea = document.getElementById("feedbackArea");
  const q = currentPracticeQuestion;

  // Подсвечиваем варианты по оригинальным индексам
  if (q && q.type !== "open") {
    const items = document.querySelectorAll(`[data-question="${questionId}"]`);
    items.forEach((item) => {
      const originalIdx = parseInt(item.dataset.original);
      item.classList.remove("selected");
      if (correctAnswer.includes(originalIdx)) {
        item.classList.add("correct");
      } else if (userAnswer.includes(originalIdx)) {
        item.classList.add("wrong");
      }
    });
  }

  feedbackArea.classList.remove("hidden");
  feedbackArea.innerHTML = `
    <div class="alert ${isCorrect ? "alert-success" : "alert-danger"}">
      ${isCorrect ? "✅ Правильно!" : "❌ Неправильно!"}
      ${!isCorrect && q && q.type !== "open" ? `<br>Правильный ответ: ${correctAnswer.map((i) => q.options[i]).join(", ")}` : ""}
      ${!isCorrect && q && q.type === "open" ? `<br>Правильный ответ: ${correctAnswer[0]}` : ""}
    </div>
    <div style="display: flex; gap: 10px; margin-top: 15px;">
      <button class="btn btn-primary" onclick="nextQuestion()">
        Следующий вопрос →
      </button>
      <button class="btn btn-outline" onclick="finishPractice()">
        Завершить практику
      </button>
    </div>
  `;

  document.getElementById("submitBtn").classList.add("hidden");
}

// Следующий вопрос в практике
function nextQuestion() {
  practiceAnswered++;
  document.getElementById("submitBtn").classList.remove("hidden");
  renderSingleQuestion();
  updateProgress();
}

// Завершить практику
async function finishPractice() {
  // Сохраняем результаты практики на сервере
  if (testResults.length > 0) {
    await savePracticeResults();
  }
  // Показываем результаты
  showPracticeResults();
}

// Сохранение результатов практики на сервере
async function savePracticeResults() {
  const studentName = document.getElementById("studentName").value.trim();

  const answersArray = testResults.map((result) => ({
    questionId: result.questionId,
    selected: result.userAnswer,
    answerTime: result.answerTime || 0,
  }));

  try {
    await fetch("/api/submit.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicId: currentTopic.id,
        studentName: studentName,
        answers: answersArray,
        practiceMode: false, // Сохраняем в статистику
      }),
    });
  } catch (error) {
    console.error("Ошибка сохранения результатов практики:", error);
  }
}

// Показать результаты практики
function showPracticeResults() {
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultsScreen").classList.remove("hidden");

  const correctCount = testResults.filter((r) => r.correct).length;
  const total = testResults.length;
  const percent = total > 0 ? (correctCount / total) * 100 : 0;

  const scoreDisplay = document.getElementById("scoreDisplay");
  const scoreText = document.getElementById("scoreText");
  const resultIcon = document.getElementById("resultIcon");

  scoreDisplay.textContent = `${correctCount}/${total}`;

  if (percent === 100) {
    resultIcon.textContent = "🏆";
    scoreText.textContent = "Превосходно! Все ответы верные!";
  } else if (percent >= 80) {
    resultIcon.textContent = "🌟";
    scoreText.textContent = "Отлично! Очень хороший результат!";
  } else if (percent >= 60) {
    resultIcon.textContent = "👍";
    scoreText.textContent = "Хорошо! Продолжай в том же духе!";
  } else if (percent >= 40) {
    resultIcon.textContent = "💪";
    scoreText.textContent = "Неплохо! Есть куда расти!";
  } else {
    resultIcon.textContent = "📚";
    scoreText.textContent = "Нужно ещё позаниматься!";
  }

  // Показываем разбор ответов
  const container = document.getElementById("reviewContainer");
  container.innerHTML = "";

  testResults.forEach((result, index) => {
    const q = result.question;
    const isCorrect = result.correct;
    const userAnswer = result.userAnswer;
    const correctAnswer = result.correctAnswer;

    const reviewEl = document.createElement("div");
    reviewEl.className = `question-card ${isCorrect ? "correct" : "wrong"}`;

    let userAnswerText = "";
    let correctAnswerText = "";

    if (q.type === "open") {
      userAnswerText = userAnswer[0] || "Нет ответа";
      correctAnswerText = correctAnswer[0] || "";
    } else {
      userAnswerText =
        userAnswer.map((i) => q.options[i]).join(", ") || "Нет ответа";
      correctAnswerText = correctAnswer.map((i) => q.options[i]).join(", ");
    }

    reviewEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
        <span class="question-number" style="background: ${isCorrect ? "var(--gradient-success)" : "var(--gradient-secondary)"}">
          ${index + 1}
        </span>
        <span style="font-size: 1.5rem;">${isCorrect ? "✅" : "❌"}</span>
      </div>
      <p class="question-text">${q.text}</p>
      <div style="margin-top: 15px; padding: 10px; background: var(--light); border-radius: var(--radius-sm);">
        <p><strong>Ваш ответ:</strong> ${userAnswerText}</p>
        ${!isCorrect ? `<p><strong>Правильный ответ:</strong> ${correctAnswerText}</p>` : ""}
      </div>
    `;

    container.appendChild(reviewEl);
  });
}

// Рендер всех вопросов (режим теста)
function renderAllQuestions() {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = "";

  questions.forEach((q, index) => {
    const questionEl = document.createElement("div");
    questionEl.className = "question-card";

    let optionsHtml = "";
    if (q.type === "open") {
      optionsHtml = `
        <div class="open-answer">
          <input 
            type="text" 
            class="form-control" 
            placeholder="Введите ваш ответ"
            onchange="saveOpenAnswer(${q.id}, this.value)"
          >
        </div>
      `;
    } else {
      const isMultiple = q.type === "multiple";
      const mapping = shuffledOptions[q.id] || [];

      optionsHtml = '<div class="options-list">';
      mapping.forEach((item) => {
        const letter = String.fromCharCode(65 + item.shuffled);
        const opt = q.options[item.original];
        optionsHtml += `
          <div 
            class="option-item ${isMultiple ? "multiple" : ""}" 
            data-question="${q.id}" 
            data-original="${item.original}"
            onclick="selectOption(${q.id}, ${item.original}, ${isMultiple})"
          >
            <span class="option-marker">${letter}</span>
            <span class="option-text">${opt}</span>
          </div>
        `;
      });
      optionsHtml += "</div>";
    }

    questionEl.innerHTML = `
      <span class="question-number">Вопрос ${index + 1}</span>
      <p class="question-text">${q.text}</p>
      ${optionsHtml}
    `;

    container.appendChild(questionEl);
  });

  // Показываем кнопку "Завершить тест"
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.textContent = "✅ Завершить тест";
  submitBtn.onclick = submitAnswers;
}

// Выбор варианта (режим теста)
function selectOption(questionId, optionIndex, isMultiple) {
  if (isMultiple) {
    if (!answers[questionId]) {
      answers[questionId] = [];
    }

    const idx = answers[questionId].indexOf(optionIndex);
    if (idx > -1) {
      answers[questionId].splice(idx, 1);
    } else {
      answers[questionId].push(optionIndex);
    }

    const items = document.querySelectorAll(`[data-question="${questionId}"]`);
    items.forEach((item) => {
      const optIdx = parseInt(item.dataset.original);
      if (answers[questionId].includes(optIdx)) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    });
  } else {
    answers[questionId] = [optionIndex];

    const items = document.querySelectorAll(`[data-question="${questionId}"]`);
    items.forEach((item) => {
      item.classList.remove("selected");
    });
    document
      .querySelector(
        `[data-question="${questionId}"][data-original="${optionIndex}"]`,
      )
      .classList.add("selected");
  }

  updateProgress();
}

// Сохранение открытого ответа
function saveOpenAnswer(questionId, value) {
  answers[questionId] = [value];
  updateProgress();
}

// Обновление прогресса
function updateProgress() {
  if (currentMode === "practice") {
    // В практике не показываем прогресс-бар
    document.getElementById("progressText").textContent =
      `Отвечено: ${practiceAnswered}`;
    document.getElementById("progressFill").style.width = "0%";
  } else {
    const answered = Object.keys(answers).length;
    const total = questions.length;
    document.getElementById("progressText").textContent =
      `Ответлено ${answered} из ${total}`;
    const percent = total > 0 ? (answered / total) * 100 : 0;
    document.getElementById("progressFill").style.width = `${percent}%`;
  }
}

// Отправка ответов (режим теста)
async function submitAnswers() {
  if (currentMode === "practice") {
    checkPracticeAnswer();
    return;
  }

  const answered = Object.keys(answers).length;
  const total = questions.length;

  if (answered < total) {
    const confirmResult = window.confirm(
      `Вы ответили на ${answered} из ${total} вопросов. Продолжить?`,
    );
    if (!confirmResult) return;
  }

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "⏳ Проверка...";

  const studentName = document.getElementById("studentName").value.trim();

  const answersArray = Object.keys(answers).map((qId) => ({
    questionId: parseInt(qId),
    selected: answers[qId],
  }));

  try {
    const response = await fetch("/api/submit.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicId: currentTopic.id,
        studentName: studentName,
        answers: answersArray,
      }),
    });

    if (!response.ok) {
      throw new Error("Ошибка сервера: " + response.status);
    }

    const result = await response.json();
    showResults(result);
  } catch (error) {
    console.error("Ошибка отправки:", error);
    alert("Не удалось отправить ответы. Попробуйте позже.");
    submitBtn.disabled = false;
    submitBtn.textContent = "✅ Завершить тест";
  }
}

// Показать результаты теста
function showResults(result) {
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultsScreen").classList.remove("hidden");

  const scoreDisplay = document.getElementById("scoreDisplay");
  const scoreText = document.getElementById("scoreText");
  const resultIcon = document.getElementById("resultIcon");

  scoreDisplay.textContent = `${result.score}/${result.total}`;

  const percent = (result.score / result.total) * 100;

  if (percent === 100) {
    resultIcon.textContent = "🏆";
    scoreText.textContent = "Превосходно! Все ответы верные!";
  } else if (percent >= 80) {
    resultIcon.textContent = "🌟";
    scoreText.textContent = "Отлично! Очень хороший результат!";
  } else if (percent >= 60) {
    resultIcon.textContent = "👍";
    scoreText.textContent = "Хорошо! Продолжай в том же духе!";
  } else if (percent >= 40) {
    resultIcon.textContent = "💪";
    scoreText.textContent = "Неплохо! Есть куда расти!";
  } else {
    resultIcon.textContent = "📚";
    scoreText.textContent = "Нужно ещё позаниматься!";
  }

  renderReview(result);
}

// Разбор ответов теста
function renderReview(result) {
  const container = document.getElementById("reviewContainer");
  container.innerHTML = "";

  questions.forEach((q, index) => {
    const resultItem = result.results.find((r) => r.questionId === q.id);
    const userAnswer = answers[q.id] || [];
    const isCorrect = resultItem ? resultItem.correct : false;
    const correctAnswer = resultItem ? resultItem.correctAnswer : [];

    const reviewEl = document.createElement("div");
    reviewEl.className = `question-card ${isCorrect ? "correct" : "wrong"}`;

    let userAnswerText = "";
    let correctAnswerText = "";

    if (q.type === "open") {
      userAnswerText = userAnswer[0] || "Нет ответа";
      correctAnswerText = correctAnswer[0] || "";
    } else {
      userAnswerText =
        userAnswer.map((i) => q.options[i]).join(", ") || "Нет ответа";
      correctAnswerText = correctAnswer.map((i) => q.options[i]).join(", ");
    }

    reviewEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
        <span class="question-number" style="background: ${isCorrect ? "var(--gradient-success)" : "var(--gradient-secondary)"}">
          ${index + 1}
        </span>
        <span style="font-size: 1.5rem;">${isCorrect ? "✅" : "❌"}</span>
      </div>
      <p class="question-text">${q.text}</p>
      <div style="margin-top: 15px; padding: 10px; background: var(--light); border-radius: var(--radius-sm);">
        <p><strong>Ваш ответ:</strong> ${userAnswerText}</p>
        ${!isCorrect ? `<p><strong>Правильный ответ:</strong> ${correctAnswerText}</p>` : ""}
      </div>
    `;

    container.appendChild(reviewEl);
  });
}

// Начать заново
function restartQuiz() {
  answers = {};
  testResults = [];
  currentQuestionIndex = 0;
  practiceAnswered = 0;
  shuffledOptions = {};

  if (currentMode === "test") {
    const count = parseInt(document.getElementById("questionCount").value);
    questions = shuffleArray([...allQuestions]).slice(0, count);

    // Перемешиваем варианты ответов для каждого вопроса
    questions.forEach((q) => {
      if (q.type !== "open" && q.options) {
        shuffledOptions[q.id] = createShuffledOptionsMapping(q.options.length);
      }
    });
  }

  document.getElementById("submitBtn").classList.remove("hidden");
  document.getElementById("submitBtn").disabled = false;
  showQuizScreen();
}
