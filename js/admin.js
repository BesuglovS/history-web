// Состояние приложения
let authToken = null;
let allResults = [];
let allTopics = [];
let currentEditTopic = null;
let sortField = "date";
let sortDirection = "desc";

// Инициализация
document.addEventListener("DOMContentLoaded", () => {
  authToken = localStorage.getItem("adminToken");
  if (authToken) {
    showAdminPanel();
  }
  setupFileUpload();
});

// Авторизация
async function login() {
  const password = document.getElementById("password").value;
  const errorEl = document.getElementById("loginError");

  if (!password) {
    errorEl.textContent = "Введите пароль";
    errorEl.classList.remove("hidden");
    return;
  }

  try {
    const response = await fetch("/api/admin/login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (response.ok) {
      authToken = data.token;
      localStorage.setItem("adminToken", authToken);
      errorEl.classList.add("hidden");
      showAdminPanel();
    } else {
      errorEl.textContent = data.error || "Неверный пароль";
      errorEl.classList.remove("hidden");
    }
  } catch (error) {
    errorEl.textContent = "Ошибка соединения";
    errorEl.classList.remove("hidden");
  }
}

// Выход
function logout() {
  authToken = null;
  localStorage.removeItem("adminToken");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("password").value = "";
}

// Показать админ-панель
function showAdminPanel() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("adminPanel").classList.remove("hidden");
  loadTopics();
  loadResults();
  loadStats();
}

// Переключение секций
function showSection(section) {
  const sections = ["topics", "upload", "stats", "results"];
  sections.forEach((s) => {
    document.getElementById(`${s}Section`).classList.add("hidden");
  });
  document.getElementById(`${section}Section`).classList.remove("hidden");

  if (section === "stats") {
    loadStats();
  } else if (section === "results") {
    loadResults();
  } else if (section === "topics") {
    loadTopics();
  }
}

// Загрузка тем
async function loadTopics() {
  try {
    const response = await fetch("/api/topics.php");
    const topics = await response.json();
    allTopics = topics;

    const topicsList = document.getElementById("topicsList");
    const noTopics = document.getElementById("noTopicsAdmin");

    topicsList.innerHTML = "";

    if (topics.length === 0) {
      noTopics.classList.remove("hidden");
      return;
    }

    noTopics.classList.add("hidden");

    topics.forEach((topic) => {
      const topicEl = document.createElement("div");
      topicEl.className = "topic-item";

      topicEl.innerHTML = `
        <span class="icon">📚</span>
        <div class="info" onclick="editTopic('${topic.id}')">
          <div class="title">${topic.title}</div>
          <div class="count">${topic.questionCount} вопросов</div>
        </div>
        <div class="topic-actions">
          <button class="btn btn-outline btn-sm" onclick="editTopic('${topic.id}')" title="Редактировать">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTopicById('${topic.id}', '${topic.title.replace(/'/g, "\\'")}')" title="Удалить">🗑️</button>
        </div>
      `;

      topicsList.appendChild(topicEl);
    });

    const filterTopic = document.getElementById("filterTopic");
    filterTopic.innerHTML = '<option value="">Все темы</option>';
    topics.forEach((topic) => {
      filterTopic.innerHTML += `<option value="${topic.id}">${topic.title}</option>`;
    });
  } catch (error) {
    console.error("Ошибка загрузки тем:", error);
  }
}

// Настройка загрузки файлов
function setupFileUpload() {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  });
}

// Загрузка файла
async function uploadFile(file) {
  const errorEl = document.getElementById("uploadError");
  const successEl = document.getElementById("uploadSuccess");

  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  if (!file.name.endsWith(".txt")) {
    errorEl.textContent = "Поддерживаются только текстовые файлы (.txt)";
    errorEl.classList.remove("hidden");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/admin/upload.php", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      successEl.innerHTML = `
        ✅ Тема "${data.topic.title}" успешно загружена!<br>
        Добавлено вопросов: ${data.topic.questionCount}
      `;
      successEl.classList.remove("hidden");
      document.getElementById("fileInput").value = "";
      loadTopics();
    } else {
      errorEl.textContent = data.error || "Ошибка загрузки файла";
      errorEl.classList.remove("hidden");
    }
  } catch (error) {
    errorEl.textContent = "Ошибка соединения с сервером";
    errorEl.classList.remove("hidden");
  }
}

// Загрузка статистики
async function loadStats() {
  try {
    const response = await fetch("/api/admin/stats.php", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const stats = await response.json();

    const statsGrid = document.getElementById("statsGrid");
    statsGrid.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.totalTopics}</div>
        <div class="stat-label">Тем</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalSessions}</div>
        <div class="stat-label">Пройдено тестов</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalStudents}</div>
        <div class="stat-label">Учеников</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.averageScore}%</div>
        <div class="stat-label">Средний результат</div>
      </div>
    `;

    const topicStatsTable = document.getElementById("topicStatsTable");
    const topicStatsArray = Object.entries(stats.topicStats);

    if (topicStatsArray.length === 0) {
      topicStatsTable.innerHTML = "<p>Нет данных</p>";
      return;
    }

    topicStatsTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Тема</th>
            <th>Попыток</th>
            <th>Средний балл</th>
          </tr>
        </thead>
        <tbody>
          ${topicStatsArray
            .map(
              ([id, ts]) => `
            <tr>
              <td>${ts.title}</td>
              <td>${ts.attempts}</td>
              <td>${ts.avgScore}%</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error("Ошибка загрузки статистики:", error);
  }
}

// Загрузка результатов
async function loadResults() {
  try {
    const response = await fetch("/api/admin/results.php", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    allResults = await response.json();
    renderResults(allResults);
  } catch (error) {
    console.error("Ошибка загрузки результатов:", error);
  }
}

// Отрисовка результатов
function renderResults(results) {
  const tbody = document.getElementById("resultsBody");

  if (results.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align: center">Нет результатов</td></tr>';
    return;
  }

  tbody.innerHTML = results
    .map((r) => {
      const date = new Date(r.date);
      const formattedDate = date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const percent = Math.round((r.score / r.total) * 100);
      const totalTime = r.answers
        ? r.answers.reduce((sum, a) => sum + (a.answerTime || 0), 0)
        : 0;
      const formattedTime = formatTime(totalTime);

      return `
      <tr onclick="showSessionDetails('${r.id}')" style="cursor: pointer;" title="Нажмите для просмотра деталей">
        <td>${formattedDate}</td>
        <td>${r.studentName}</td>
        <td>${r.topicTitle}</td>
        <td>
          <span style="font-weight: 600; color: ${percent >= 60 ? "var(--success)" : "var(--danger)"}">
            ${r.score}/${r.total} (${percent}%)
          </span>
        </td>
        <td>${formattedTime}</td>
      </tr>
    `;
    })
    .join("");
}

// Форматирование времени
function formatTime(ms) {
  if (!ms || ms === 0) return "-";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) {
    return `${minutes}м ${secs}с`;
  }
  return `${secs}с`;
}

// Показать детали сессии
async function showSessionDetails(sessionId) {
  const session = allResults.find((r) => r.id === sessionId);
  if (!session || !session.answers) {
    alert("Детали недоступны");
    return;
  }

  const modal = document.getElementById("detailsModal");
  const content = document.getElementById("detailsContent");

  let questionsMap = {};
  try {
    const response = await fetch(
      `/api/admin/topics.php?id=${session.topicId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );
    if (response.ok) {
      const topicData = await response.json();
      topicData.questions.forEach((q) => {
        questionsMap[q.id] = q;
      });
    }
  } catch (error) {
    console.error("Ошибка загрузки вопросов:", error);
  }

  let answersHtml = "";
  session.answers.forEach((a, index) => {
    const timeStr = formatTime(a.answerTime || 0);
    const statusIcon = a.correct ? "✅" : "❌";
    const question = questionsMap[a.questionId];

    let userAnswerText = "";
    if (a.userAnswer && a.userAnswer.length > 0) {
      if (question && question.type === "open") {
        userAnswerText = a.userAnswer[0] || "—";
      } else if (question && question.options) {
        userAnswerText = a.userAnswer
          .map((idx) => question.options[idx])
          .filter(Boolean)
          .join(", ");
      } else {
        userAnswerText = a.userAnswer.join(", ");
      }
    } else {
      userAnswerText = "Нет ответа";
    }

    let correctAnswerText = "";
    if (a.correctAnswer && a.correctAnswer.length > 0) {
      if (question && question.type === "open") {
        correctAnswerText = a.correctAnswer[0] || "—";
      } else if (question && question.options) {
        correctAnswerText = a.correctAnswer
          .map((idx) => question.options[idx])
          .filter(Boolean)
          .join(", ");
      } else {
        correctAnswerText = a.correctAnswer.join(", ");
      }
    }

    const questionText = question ? question.text : "";
    const hasQuestionText = questionText && questionText.length > 0;

    answersHtml += `
      <div class="detail-answer ${a.correct ? "correct" : "wrong"}">
        <div class="answer-header">
          <span class="answer-number" ${hasQuestionText ? `onclick="toggleQuestionText(this)" style="cursor: pointer; text-decoration: underline;" title="Нажмите, чтобы увидеть вопрос"` : ""}>Вопрос ${index + 1}</span>
          <span class="answer-status">${statusIcon}</span>
          <span class="answer-time">⏱️ ${timeStr}</span>
        </div>
        ${
          hasQuestionText
            ? `
        <div class="question-text-hidden" style="display: none; margin-top: 10px; padding: 12px; background: var(--light); border-radius: 8px; border-left: 4px solid var(--primary);">
          <p style="margin: 0; font-weight: 500;">${questionText}</p>
        </div>
        `
            : ""
        }
        <div class="answer-details" style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.5); border-radius: 8px;">
          <p style="margin: 5px 0;"><strong>Ответ ученика:</strong> <span style="color: ${a.correct ? "var(--success)" : "var(--danger)"}">${userAnswerText}</span></p>
          ${!a.correct ? `<p style="margin: 5px 0;"><strong>Правильный ответ:</strong> <span style="color: var(--success)">${correctAnswerText}</span></p>` : ""}
        </div>
      </div>
    `;
  });

  const totalTime = session.answers.reduce(
    (sum, a) => sum + (a.answerTime || 0),
    0,
  );
  const avgTime =
    session.answers.length > 0 ? totalTime / session.answers.length : 0;

  content.innerHTML = `
    <div class="session-summary">
      <h4>${session.studentName}</h4>
      <p><strong>Тема:</strong> ${session.topicTitle}</p>
      <p><strong>Результат:</strong> ${session.score}/${session.total} (${Math.round((session.score / session.total) * 100)}%)</p>
      <p><strong>Общее время:</strong> ${formatTime(totalTime)}</p>
      <p><strong>Среднее время на вопрос:</strong> ${formatTime(avgTime)}</p>
    </div>
    <div class="answers-list">
      <h4>Ответы по вопросам:</h4>
      ${answersHtml}
    </div>
  `;

  modal.classList.add("active");
}

// Закрыть детали сессии
function closeDetailsModal() {
  document.getElementById("detailsModal").classList.remove("active");
}

// Фильтрация результатов
function filterResults() {
  const nameFilter = document.getElementById("filterName").value.toLowerCase();
  const topicFilter = document.getElementById("filterTopic").value;
  const dateFilter = document.getElementById("filterDate").value;

  let filtered = [...allResults];

  if (nameFilter) {
    filtered = filtered.filter((r) =>
      r.studentName.toLowerCase().includes(nameFilter),
    );
  }

  if (topicFilter) {
    filtered = filtered.filter((r) => r.topicId === topicFilter);
  }

  if (dateFilter) {
    filtered = filtered.filter((r) => r.date.startsWith(dateFilter));
  }

  renderResults(filtered);
}

// Сортировка результатов
function sortResults(field) {
  if (sortField === field) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortField = field;
    sortDirection = "desc";
  }

  allResults.sort((a, b) => {
    let aVal, bVal;

    switch (field) {
      case "date":
        aVal = new Date(a.date);
        bVal = new Date(b.date);
        break;
      case "name":
        aVal = a.studentName.toLowerCase();
        bVal = b.studentName.toLowerCase();
        break;
      case "topic":
        aVal = a.topicTitle.toLowerCase();
        bVal = b.topicTitle.toLowerCase();
        break;
      case "score":
        aVal = a.score / a.total;
        bVal = b.score / b.total;
        break;
    }

    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  renderResults(allResults);
}

// Редактирование темы
async function editTopic(topicId) {
  try {
    const response = await fetch(`/api/admin/topics.php?id=${topicId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    currentEditTopic = await response.json();

    document.getElementById("editTitle").value = currentEditTopic.title;
    renderEditQuestions();

    document.getElementById("editModal").classList.add("active");
  } catch (error) {
    console.error("Ошибка загрузки темы:", error);
    alert("Не удалось загрузить тему");
  }
}

// Отрисовка вопросов в редакторе
function renderEditQuestions() {
  const container = document.getElementById("editQuestions");
  container.innerHTML = "";

  currentEditTopic.questions.forEach((q, index) => {
    const questionEl = document.createElement("div");
    questionEl.className = "question-edit";
    questionEl.dataset.index = index;

    let optionsHtml = "";
    q.options.forEach((opt, optIndex) => {
      const isChecked = q.answer.includes(optIndex) ? "checked" : "";
      optionsHtml += `
        <div class="option-edit">
          <input type="checkbox" ${isChecked} data-qindex="${index}" data-optindex="${optIndex}" class="answer-checkbox">
          <input type="text" value="${opt}" class="option-text form-control" data-qindex="${index}" data-optindex="${optIndex}">
          <button class="btn btn-danger btn-sm" onclick="removeOption(${index}, ${optIndex})">✕</button>
        </div>
      `;
    });

    questionEl.innerHTML = `
      <div class="question-edit-header">
        <span>Вопрос ${index + 1}</span>
        <button class="btn btn-danger btn-sm" onclick="removeQuestion(${index})">Удалить</button>
      </div>
      <div class="form-group">
        <input type="text" class="form-control question-text-input" value="${q.text}" placeholder="Текст вопроса">
      </div>
      <div class="form-group">
        <label>Тип вопроса</label>
        <select class="form-control question-type" onchange="changeQuestionType(${index}, this.value)">
          <option value="single" ${q.type === "single" ? "selected" : ""}>Один ответ</option>
          <option value="multiple" ${q.type === "multiple" ? "selected" : ""}>Несколько ответов</option>
          <option value="open" ${q.type === "open" ? "selected" : ""}>Открытый ответ</option>
        </select>
      </div>
      <div class="options-container" ${q.type === "open" ? 'style="display:none"' : ""}>
        <label>Варианты ответов (отметьте правильные)</label>
        ${optionsHtml}
        <button class="btn btn-outline btn-sm" onclick="addOption(${index})" style="margin-top: 10px">+ Добавить вариант</button>
      </div>
      <div class="open-answer-container" ${q.type !== "open" ? 'style="display:none"' : ""}>
        <label>Правильный ответ</label>
        <input type="text" class="form-control open-answer-input" value="${q.answer[0] || ""}" placeholder="Правильный ответ">
      </div>
    `;

    container.appendChild(questionEl);
  });
}

// Добавить вопрос
function addQuestion() {
  currentEditTopic.questions.push({
    id: currentEditTopic.questions.length + 1,
    text: "",
    type: "single",
    options: ["", "", "", ""],
    answer: [],
  });
  renderEditQuestions();
}

// Удалить вопрос
function removeQuestion(index) {
  currentEditTopic.questions.splice(index, 1);
  renderEditQuestions();
}

// Добавить вариант ответа
function addOption(questionIndex) {
  currentEditTopic.questions[questionIndex].options.push("");
  renderEditQuestions();
}

// Удалить вариант ответа
function removeOption(questionIndex, optionIndex) {
  currentEditTopic.questions[questionIndex].options.splice(optionIndex, 1);
  const answers = currentEditTopic.questions[questionIndex].answer;
  currentEditTopic.questions[questionIndex].answer = answers
    .filter((a) => a !== optionIndex)
    .map((a) => (a > optionIndex ? a - 1 : a));
  renderEditQuestions();
}

// Изменить тип вопроса
function changeQuestionType(questionIndex, newType) {
  currentEditTopic.questions[questionIndex].type = newType;
  if (newType === "open") {
    currentEditTopic.questions[questionIndex].answer = [""];
  }
  renderEditQuestions();
}

// Сохранить тему
async function saveTopic() {
  const title = document.getElementById("editTitle").value.trim();
  if (!title) {
    alert("Введите название темы");
    return;
  }

  const questions = [];
  const questionEls = document.querySelectorAll(".question-edit");

  questionEls.forEach((el, index) => {
    const text = el.querySelector(".question-text-input").value.trim();
    const type = el.querySelector(".question-type").value;

    if (!text) return;

    const question = {
      id: index + 1,
      text,
      type,
      options: [],
      answer: [],
    };

    if (type === "open") {
      const openAnswer = el.querySelector(".open-answer-input").value.trim();
      question.answer = [openAnswer];
    } else {
      const optionInputs = el.querySelectorAll(".option-text");
      const checkboxes = el.querySelectorAll(".answer-checkbox");

      optionInputs.forEach((input, optIndex) => {
        const optText = input.value.trim();
        if (optText) {
          question.options.push(optText);
          if (checkboxes[optIndex] && checkboxes[optIndex].checked) {
            question.answer.push(optIndex);
          }
        }
      });
    }

    if (question.options.length > 0 || type === "open") {
      questions.push(question);
    }
  });

  if (questions.length === 0) {
    alert("Добавьте хотя бы один вопрос");
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/topics.php?id=${currentEditTopic.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ title, questions }),
      },
    );

    if (response.ok) {
      closeModal();
      loadTopics();
      alert("Тема успешно сохранена!");
    } else {
      const data = await response.json();
      alert(data.error || "Ошибка сохранения");
    }
  } catch (error) {
    console.error("Ошибка сохранения:", error);
    alert("Ошибка сохранения темы");
  }
}

// Удалить тему из модального окна редактирования
async function deleteTopic() {
  if (!confirm("Удалить эту тему? Это действие нельзя отменить.")) {
    return;
  }

  try {
    const response = await fetch(
      `/api/admin/topics.php?id=${currentEditTopic.id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      },
    );

    if (response.ok) {
      closeModal();
      loadTopics();
      alert("Тема удалена");
    } else {
      const data = await response.json();
      alert(data.error || "Ошибка удаления");
    }
  } catch (error) {
    console.error("Ошибка удаления:", error);
    alert("Ошибка удаления темы");
  }
}

// Удалить тему по ID (без редактирования)
async function deleteTopicById(topicId, topicTitle) {
  if (!confirm(`Удалить тему "${topicTitle}"? Это действие нельзя отменить.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/topics.php?id=${topicId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (response.ok) {
      loadTopics();
      alert("Тема удалена");
    } else {
      const data = await response.json();
      alert(data.error || "Ошибка удаления");
    }
  } catch (error) {
    console.error("Ошибка удаления:", error);
    alert("Ошибка удаления темы");
  }
}

// Закрыть модальное окно
function closeModal() {
  document.getElementById("editModal").classList.remove("active");
  currentEditTopic = null;
}

// Переключить видимость текста вопроса
function toggleQuestionText(element) {
  const answerDiv = element.closest(".detail-answer");
  const questionTextDiv = answerDiv.querySelector(".question-text-hidden");
  if (questionTextDiv) {
    if (questionTextDiv.style.display === "none") {
      questionTextDiv.style.display = "block";
    } else {
      questionTextDiv.style.display = "none";
    }
  }
}
