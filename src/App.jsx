import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [topics, setTopics] = useState(() => {
    const saved = localStorage.getItem('voicedeck_topics');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTopicId, setActiveTopicId] = useState(null);

  // Состояния для форм и редактирования
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState(null);
  const [editTopicName, setEditTopicName] = useState("");

  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardEn, setNewCardEn] = useState("");
  const [newCardRu, setNewCardRu] = useState("");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editCardEn, setEditCardEn] = useState("");
  const [editCardRu, setEditCardRu] = useState("");
  
  const [revealedCards, setRevealedCards] = useState({});

  // Состояния для тренировки
  const [isTraining, setIsTraining] = useState(false);
  const [trainingQueue, setTrainingQueue] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [showHint, setShowHint] = useState(false);

  // Кастомная модалка
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', isConfirm: false, onConfirm: null });

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));
  
  const showAlert = (title, message) => {
    setModal({ isOpen: true, title, message, isConfirm: false, onConfirm: null });
  };

  const showConfirm = (title, message, onConfirm) => {
    setModal({ isOpen: true, title, message, isConfirm: true, onConfirm });
  };

  useEffect(() => {
    localStorage.setItem('voicedeck_topics', JSON.stringify(topics));
  }, [topics]);

  // --- УПРАВЛЕНИЕ ТЕМАМИ ---
  const handleAddTopic = (e) => {
    e.preventDefault();
    if (newTopicName.trim() !== "") {
      const newTopic = { id: Date.now().toString(), name: newTopicName.trim(), cards: [] };
      setTopics([...topics, newTopic]);
      setNewTopicName("");
      setIsAddingTopic(false);
    }
  };

  const handleEditTopic = (e) => {
    e.preventDefault();
    if (editTopicName.trim() !== "") {
      setTopics(topics.map(t => t.id === editingTopicId ? { ...t, name: editTopicName.trim() } : t));
      setEditingTopicId(null);
    }
  };

  const deleteTopic = (id, e) => {
    e.stopPropagation();
    showConfirm("Delete Topic", "Are you sure you want to delete this topic and all its phrases?", () => {
      setTopics(topics.filter(t => t.id !== id));
      closeModal();
    });
  };

  // --- УПРАВЛЕНИЕ КАРТОЧКАМИ ---
  const handleAddCard = (e) => {
    e.preventDefault();
    if (newCardEn.trim() && newCardRu.trim()) {
      const newCard = { id: Date.now().toString(), en: newCardEn.trim(), ru: newCardRu.trim() };
      const updatedTopics = topics.map(topic => {
        if (topic.id === activeTopicId) return { ...topic, cards: [...topic.cards, newCard] };
        return topic;
      });
      setTopics(updatedTopics);
      setNewCardEn("");
      setNewCardRu("");
      setIsAddingCard(false);
    }
  };

  const handleEditCard = (e) => {
    e.preventDefault();
    if (editCardEn.trim() && editCardRu.trim()) {
      const updatedTopics = topics.map(topic => {
        if (topic.id === activeTopicId) {
          const updatedCards = topic.cards.map(c => 
            c.id === editingCardId ? { ...c, en: editCardEn.trim(), ru: editCardRu.trim() } : c
          );
          return { ...topic, cards: updatedCards };
        }
        return topic;
      });
      setTopics(updatedTopics);
      setEditingCardId(null);
    }
  };

  const deleteCard = (cardId, e) => {
    e.stopPropagation();
    showConfirm("Delete Phrase", "Are you sure you want to delete this phrase?", () => {
      const updatedTopics = topics.map(topic => {
        if (topic.id === activeTopicId) return { ...topic, cards: topic.cards.filter(c => c.id !== cardId) };
        return topic;
      });
      setTopics(updatedTopics);
      closeModal();
    });
  };

  const handleRevealAndPlay = (card, e) => {
    e.stopPropagation();
    setRevealedCards(prev => ({ ...prev, [card.id]: true }));
    const utterance = new SpeechSynthesisUtterance(card.en);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const playAudio = (text, e) => {
    if (e) e.stopPropagation();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const activeTopic = topics.find(t => t.id === activeTopicId);

  // --- ТРЕНИРОВКА ---
  const startTraining = () => {
    const shuffled = [...activeTopic.cards].sort(() => Math.random() - 0.5);
    setTrainingQueue(shuffled);
    setIsTraining(true);
    setCurrentCardIndex(0);
    setRecognitionResult(null);
    setShowHint(false);
  };

  const startListening = () => {
    setRecognitionResult(null);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAlert("Not Supported", "Your browser does not support Speech Recognition. Please use Google Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      const expected = trainingQueue[currentCardIndex].en.toLowerCase();
      
      const normalize = (str) => str.replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
      const saidWords = normalize(transcript).split(' ');
      const expectedWords = normalize(expected).split(' ');
      
      let matchedWords = 0;
      expectedWords.forEach(word => {
        if (saidWords.includes(word)) matchedWords++;
      });
      
      const matchPercentage = matchedWords / expectedWords.length;

      if (matchPercentage >= 0.7) {
        setRecognitionResult({ status: 'success', said: transcript });
      } else {
        setRecognitionResult({ status: 'fail', said: transcript });
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      showAlert("Recognition Error", "Error occurred: " + event.error + ". Try checking your internet connection.");
    };

    recognition.start();
  };

  const handleNextCard = () => {
    if (recognitionResult && recognitionResult.status === 'fail') {
      const failedCard = trainingQueue[currentCardIndex];
      setTrainingQueue([...trainingQueue, failedCard]);
    }

    if (currentCardIndex < trainingQueue.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setRecognitionResult(null);
      setShowHint(false);
    } else {
      if (recognitionResult && recognitionResult.status === 'success') {
         showAlert("Great Job!", "You finished all phrases in this topic.");
         setIsTraining(false);
      } else {
         setCurrentCardIndex(prev => prev + 1);
         setRecognitionResult(null);
         setShowHint(false);
      }
    }
  };

  // --- ОТРИСОВКА ---
  const renderContent = () => {
    if (isTraining && trainingQueue.length > 0) {
      const currentCard = trainingQueue[currentCardIndex];
      return (
        <div className="app-container">
          <button className="back-btn floating-back" onClick={() => setIsTraining(false)}>← Exit</button>
          <header className="topic-header" style={{ justifyContent: 'center' }}>
            <h1>{currentCardIndex + 1} / {trainingQueue.length}</h1>
          </header>

          <main className="training-screen">
            <div className="prompt-text">{currentCard.ru}</div>
            
            <div className="mic-section">
              <button className={`mic-btn ${isListening ? 'listening' : ''}`} onClick={startListening}>
                🎤
              </button>
              <p>{isListening ? "Listening..." : "Tap to speak"}</p>
            </div>

            {!recognitionResult && (
              <div className="hint-section">
                {showHint ? (
                  <p className="hint-text">Hint: {currentCard.en}</p>
                ) : (
                  <button className="hint-btn" onClick={() => setShowHint(true)}>Need a hint?</button>
                )}
              </div>
            )}

            {recognitionResult && (
              <div className={`result-box ${recognitionResult.status}`}>
                {recognitionResult.status === 'success' ? (
                  <>
                    <h3>✅ Correct!</h3>
                    <p>You said: "{recognitionResult.said}"</p>
                    <button className="next-btn" onClick={handleNextCard}>Next →</button>
                  </>
                ) : (
                  <>
                    <h3>❌ Try again</h3>
                    <p>You said: "{recognitionResult.said}"</p>
                    <p className="expected-text">Expected: "{currentCard.en}"</p>
                    <div className="result-actions">
                      <button className="listen-btn" onClick={() => playAudio(currentCard.en)}>🔊 Listen</button>
                      <button className="next-btn" onClick={handleNextCard}>Next →</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </main>
        </div>
      );
    }

    if (activeTopic) {
      return (
        <div className="app-container">
          <button className="back-btn floating-back" onClick={() => { setActiveTopicId(null); setIsAddingCard(false); setEditingCardId(null); }}>
            ← Back
          </button>
          <header className="topic-header" style={{ justifyContent: 'center' }}>
            <h1>{activeTopic.name}</h1>
          </header>

          <main>
            {!isAddingCard && !editingCardId ? (
              <button className="add-btn" onClick={() => setIsAddingCard(true)}>+ Add Phrase</button>
            ) : isAddingCard ? (
              <form className="card-form" onSubmit={handleAddCard}>
                <input placeholder="English phrase" value={newCardEn} onChange={e => setNewCardEn(e.target.value)} autoFocus />
                <input placeholder="Russian translation" value={newCardRu} onChange={e => setNewCardRu(e.target.value)} />
                <div className="form-actions">
                  <button type="submit" className="save-btn">Save</button>
                  <button type="button" className="cancel-btn" onClick={() => setIsAddingCard(false)}>Cancel</button>
                </div>
              </form>
            ) : null}

            {activeTopic.cards.length === 0 ? (
              <div className="empty-state" style={{ marginTop: '20px' }}>It's empty here. Add your first phrase!</div>
            ) : (
              <ul className="cards-list" style={{ marginTop: '20px' }}>
                {activeTopic.cards.map(card => (
                  <li key={card.id} className="card-item">
                    {editingCardId === card.id ? (
                      <form className="card-form" style={{ width: '100%', margin: 0, padding: 0, boxShadow: 'none', background: 'transparent' }} onSubmit={handleEditCard}>
                        <input value={editCardEn} onChange={e => setEditCardEn(e.target.value)} autoFocus />
                        <input value={editCardRu} onChange={e => setEditCardRu(e.target.value)} />
                        <div className="form-actions">
                          <button type="submit" className="save-btn">Save</button>
                          <button type="button" className="cancel-btn" onClick={() => setEditingCardId(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="card-text">
                          <div className="ru-text">{card.ru}</div>
                          {revealedCards[card.id] && (
                            <div className="en-text-revealed">{card.en}</div>
                          )}
                        </div>
                        <div className="card-actions">
                          <button className="icon-btn" onClick={(e) => handleRevealAndPlay(card, e)}>🔊</button>
                          <button className="icon-btn" onClick={() => { setEditingCardId(card.id); setEditCardEn(card.en); setEditCardRu(card.ru); }}>✏️</button>
                          <button className="icon-btn" onClick={(e) => deleteCard(card.id, e)}>🗑️</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            
            {activeTopic.cards.length > 0 && !isAddingCard && !editingCardId && (
               <button className="train-btn" onClick={startTraining}>🎤 Practice</button>
            )}
          </main>
        </div>
      );
    }

    return (
      <div className="app-container">
        <header>
          <h1>🎧 VoiceDeck</h1>
          <p>Your voice dictionary</p>
        </header>

        <main>
          {!isAddingTopic && !editingTopicId ? (
            <button className="add-btn" onClick={() => setIsAddingTopic(true)}>+ New Topic</button>
          ) : isAddingTopic ? (
            <form className="card-form" onSubmit={handleAddTopic}>
              <input placeholder="Topic name" value={newTopicName} onChange={e => setNewTopicName(e.target.value)} autoFocus />
              <div className="form-actions">
                <button type="submit" className="save-btn">Create</button>
                <button type="button" className="cancel-btn" onClick={() => setIsAddingTopic(false)}>Cancel</button>
              </div>
            </form>
          ) : null}

          {topics.length === 0 ? (
            <div className="empty-state" style={{ marginTop: '20px' }}>No topics yet. Click "+ New Topic" to start!</div>
          ) : (
            <ul className="topics-list" style={{ marginTop: '20px' }}>
              {topics.map(topic => (
                <li key={topic.id} className="topic-card">
                  {editingTopicId === topic.id ? (
                    <form className="card-form" style={{ width: '100%', margin: 0, padding: 0, boxShadow: 'none', background: 'transparent' }} onSubmit={handleEditTopic}>
                      <input value={editTopicName} onChange={e => setEditTopicName(e.target.value)} autoFocus />
                      <div className="form-actions">
                        <button type="submit" className="save-btn">Save</button>
                        <button type="button" className="cancel-btn" onClick={() => setEditingTopicId(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="topic-info" onClick={() => setActiveTopicId(topic.id)} style={{ flex: 1, cursor: 'pointer' }}>
                        <h3>{topic.name}</h3>
                        <span>{topic.cards.length} phrases</span>
                      </div>
                      <div className="card-actions">
                        <button className="icon-btn" onClick={() => { setEditingTopicId(topic.id); setEditTopicName(topic.name); }}>✏️</button>
                        <button className="icon-btn" onClick={(e) => deleteTopic(topic.id, e)}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    );
  };

  return (
    <>
      {renderContent()}
      
          {/* Рендер кастомной модалки */}
      {modal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{modal.title}</h2>
            <p>{modal.message}</p>
            <div className="modal-actions">
              {modal.isConfirm ? (
                <>
                  {/* Cancel теперь зеленая (безопасная) */}
                  <button className="save-btn" onClick={closeModal}>Cancel</button>
                  {/* Confirm теперь красная (опасная) */}
                  <button className="danger-btn" onClick={modal.onConfirm}>Confirm</button>
                </>
              ) : (
                <button className="save-btn" style={{ flex: 1 }} onClick={closeModal}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;