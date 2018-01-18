;
(function() {
  'use strict';

  var config = {
    apiKey: "AIzaSyBXc88ZPfXbi9n_Nnvd3QfJOYztBDpt5mA",
    authDomain: "play-harp-guildwars-2.firebaseapp.com",
    databaseURL: "https://play-harp-guildwars-2.firebaseio.com",
    projectId: "play-harp-guildwars-2",
    storageBucket: "play-harp-guildwars-2.appspot.com",
    messagingSenderId: "957207051422"
  };

  firebase.initializeApp(config);

  firebase.auth().signInAnonymously().catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;

    if (errorCode === 'auth/operation-not-allowed') {
      console.error('You must enable Anonymous auth in the Firebase Console.');
    } else {
      console.error(error);
    }
  });

  // Initialize Cloud Firestore through Firebase
  var db = firebase.firestore();

  let playback = [];

  var skillToKeyCode = JSON.parse(window.localStorage.getItem('skillToKeyCode')) || {
    '1': '49',
    '2': '50',
    '3': '51',
    '4': '52',
    '5': '53',
    '6': '54',
    '7': '55',
    '8': '56',
    '9': '57',
    '0': '48',
  };

  function keyCodeToSkill(which) {
    for (var skill in skillToKeyCode) {
      if (skillToKeyCode.hasOwnProperty(skill) && which == skillToKeyCode[skill]) {
        return skill;
      }
    }
  }

  var skillToNoteOctave = {
    '1': ['C3', 'C4', 'C5'],
    '2': ['D3', 'D4', 'D5'],
    '3': ['E3', 'E4', 'E5'],
    '4': ['F3', 'F4', 'F5'],
    '5': ['G3', 'G4', 'G5'],
    '6': ['A3', 'A4', 'A5'],
    '7': ['B3', 'B4', 'B5'],
    '8': ['C4', 'C5', 'C6'],

    '9': ['-1', '-1', '-1'],
    '0': ['+1', '+1', '+1'],
  };

  var sounds = {
    'C3': [],
    'D3': [],
    'E3': [],
    'F3': [],
    'G3': [],
    'A3': [],
    'B3': [],
    'C4': [],
    'D4': [],
    'E4': [],
    'F4': [],
    'G4': [],
    'A4': [],
    'B4': [],
    'C5': [],
    'D5': [],
    'E5': [],
    'F5': [],
    'G5': [],
    'A5': [],
    'B5': [],
    'C6': [],
  };

  var musicVolume = parseFloat(localStorage.getItem('musicVolume')) || 0.6;

  var didLoad = false;
  var activeNotes = {};
  var defaultOctave = 1;
  var currentOctave = 1;

  // Pre-loading the audio files is useless when the browser caches them.
  function preloadSounds(sounds, cb) {
    var loadedCount = 0;
    var toLoadCount = 0;

    // Mind that each audio file will be new-ed five times. If the browser
    // doesn't cache the downloaded audio, it will result in 5 * sounds.length
    // (5 * 22) requests.
    var queueLength = 5;

    for (var note in sounds) {
      if ( ! sounds.hasOwnProperty(note)) {
        continue;
      }

      toLoadCount++;

      for (var i = 0; i < queueLength; i++) {
        var audio = loadAudio(note);

        // This event will fire every time the audio is ready to be played and
        // not only once "onload"...
        audio.addEventListener('canplaythrough', function(note) {
          // ...we therefore check whether we've or not already loaded all the
          // needed audio files.
          if (loadedCount >= toLoadCount * queueLength) {
            return
          };

          loadedCount++;
          cb(loadedCount, toLoadCount * queueLength);

        // binds the current note to the callback so it uses the right one when
        // it is called.
        }.bind(null, note), false);

        sounds[note].push(audio);
      }
    }
  }

  preloadSounds(sounds, function(loaded, total) {
    var remaining = total - loaded;

    if (remaining === 0) {
      didLoad = true;
      var loadingScreen = document.getElementById('loadingScreen');
      loadingScreen.classList.add('fadeOut');
      setTimeout(function() {
        loadingScreen.remove();
      }, 1500);
    }
  });

  var recording = false;
  var recordingStartedAt = null;

  const ACTION_START_RECORDING = 1;
  const ACTION_STOP_RECORDING = 2;
  const ACTION_PLAY_NOTE = 3;
  const ACTION_CHANGE_OCTAVE = 4;
  const ACTION_ON_SKILL_ACTIVATION = 5;
  const ACTION_ON_SKILL_DEACTIVATION = 6;

  function record(action, payload) {
    if ( ! recording) {
      return;
    }

    const now = +new Date;

    // @todo 2018-01-14 Refactor.
    //  I don't like this check. Can also be playback.length === 0
    if (action === ACTION_START_RECORDING) {
      recordingStartedAt = now;
    }

    if (payload) {
      playback.push({ o: now - recordingStartedAt, a: action, p: payload });
    } else {
      playback.push({ o: now - recordingStartedAt, a: action });
    }
  }

  function addActiveStatus(element) {
    element && element.classList.add('is-active');
  }

  function removeActiveStatus(element) {
    element && element.classList.remove('is-active');
  }

  function shouldLivePlay() {
    return document.getElementById('recording-live-playing').checked;
  }

  function handleOctaveChange(octave) {
    var skillBar = document.getElementById('skill-bar');
    var buffBar = document.getElementById('buff-bar');

    buffBar.classList.remove('octave-0', 'octave-1', 'octave-2');
    buffBar.classList.add('octave-' + octave);

    setTimeout(function() {
      skillBar.classList.remove('octave-0', 'octave-1', 'octave-2');
      skillBar.classList.add('octave-' + octave);
    }, 100);

    var elements = document.querySelectorAll('.front');
    for (var i = 0; i < elements.length; i++) {
      elements[i].style.transform = 'rotateX(' + (Math.abs(defaultOctave - octave) * 180) + 'deg)';
    }

    var elements = document.querySelectorAll('.back');
    for (var i = 0; i < elements.length; i++) {
      elements[i].style.transform = 'rotateX(' + ((Math.abs(defaultOctave - octave) * 180) + 180) + 'deg)';
    }

    currentOctave = octave;
    record(ACTION_CHANGE_OCTAVE, [octave]);
  }

  handleOctaveChange(currentOctave);

  function loadAudio(note) {
    var audio = new Audio('audio/' + note + '.mp3');
    audio.addEventListener('ended', function() {
      audio.currentTime = 0;
    });
    return audio;
  }

  function playNote(note, volume) {
    var preLoaded = sounds[note];

    for (var i = 0; i < preLoaded.length; i++) {
      // I don't think it's necessary to check for ".paused".
      if ( ! ( ! preLoaded[i].paused || preLoaded[i].currentTime)) {
        preLoaded[i].volume = volume;
        preLoaded[i].play();
        record(ACTION_PLAY_NOTE, [note, volume]);
        return;
      }
    }

    // If no playable audio is found in the preLoaded array, we load a new one,
    // play it and add it to the preLoaded sounds.
    // Note that if the browser is not caching the audio file, there will be
    // a bit of delay between the "play"-action and the note playing.
    var audio = loadAudio(note);
    audio.volume = volume;
    audio.play();
    record(ACTION_PLAY_NOTE, [note, volume]);
    sounds[note].push(audio);
  }

  function onSkillActivation(skill, octave) {
    if ( ! didLoad) {
      return;
    }

    if (activeNotes[skill]) {
      return;
    }

    activeNotes[skill] = +new Date();

    if ( ! (skillToNoteOctave[skill] && skillToNoteOctave[skill][octave])) {
      return;
    }

    var note = skillToNoteOctave[skill][octave];

    record(ACTION_ON_SKILL_ACTIVATION, [note, octave]);

    if (octave === currentOctave) {
      addActiveStatus(document.getElementById('skill-' + skill));
    }

    if (note === '-1') {
      handleOctaveChange(Math.max(0, octave - 1));
      return;
    }

    if (note === '+1') {
      handleOctaveChange(Math.min(2, octave + 1));
      return;
    }

    playNote(note, musicVolume);
  };

  function onSkillDeactivation(skill, octave) {
    if ( ! didLoad) {
      return;
    }

    if ( ! (skillToNoteOctave[skill] && skillToNoteOctave[skill][octave])) {
      return;
    }

    var note = skillToNoteOctave[skill][octave];

    record(ACTION_ON_SKILL_DEACTIVATION, [note, octave]);

    removeActiveStatus(document.getElementById('skill-' + skill));
    delete activeNotes[skill];
  }

  document.addEventListener('keydown', function(e) {
    onSkillActivation(keyCodeToSkill(e.which), currentOctave);
  }, false);

  document.addEventListener('keyup', function(e) {
    onSkillDeactivation(keyCodeToSkill(e.which), currentOctave);
  }, false);

  document.addEventListener('mousewheel', function(e) {
    e.preventDefault();
  }, false);

  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  }, false);

  // Allow to skill-click
  var skills = document.querySelectorAll('.js-skill');

  for (var i = 0; i < skills.length; i++) {
    skills[i].addEventListener('mousedown', function(e) {
      if (e.which !== 1) {
        return;
      }

      const skill = e.currentTarget.getAttribute('data-skill-id');
      onSkillActivation(skill, currentOctave);
    }, false);

    skills[i].addEventListener('mouseup', function(e) {
      if (e.which !== 1) {
        return;
      }

      const skill = e.currentTarget.getAttribute('data-skill-id');
      onSkillDeactivation(skill, currentOctave);
    }, false);

    skills[i].addEventListener('mouseleave', function(e) {
      const skill = e.currentTarget.getAttribute('data-skill-id');
      onSkillDeactivation(skill, currentOctave);
    }, false);
  }

  /**
   * Goes through every key-bind key control and updates its text
   * @param  {NodeList} controls The array of key-bind control elements
   */
  function renderControlOptions(controls) {
    for (var i = 0; i < controls.length; i++) {
      var control = keybindControls[i];
      control.innerHTML = String.fromCharCode(skillToKeyCode[control.dataset.skill]);
    }
  }

  // Allow to open the option sections by clicking on their titles.
  var sectionControls = document.querySelectorAll('.js-o-section-head');

  for (var i = 0; i < sectionControls.length; i++) {
    var control = sectionControls[i];

    control.addEventListener('click', function(e) {
      e.target.classList.toggle('is-active');
    }, false);
  }

  // Allow to set the key-bind by clicking on .js-o-keykind and pressing a key.
  var keybindControls = document.querySelectorAll('.js-o-keybind');

  renderControlOptions(keybindControls);

  for (var i = 0; i < keybindControls.length; i++) {
    var control = keybindControls[i];

    control.addEventListener('click', function(clickEvent) {
      clickEvent.target.innerHTML = '-';
      document.addEventListener('keyup', function onKeyBind(keyupEvent) {
        var existingSkillKeyBind;

        if (existingSkillKeyBind = keyCodeToSkill(keyupEvent.which)) {
          skillToKeyCode[existingSkillKeyBind] = undefined;
        }

        skillToKeyCode[clickEvent.target.dataset.skill] = keyupEvent.which;

        window.localStorage.setItem('skillToKeyCode', JSON.stringify(skillToKeyCode));

        renderControlOptions(keybindControls);
        document.removeEventListener('keyup', onKeyBind);
      }, false);
    }, false);
  }

  // Allow to change the audio volume
  var volumeControl = document.getElementById('music-volume-control');

  volumeControl.value = musicVolume;

  volumeControl.addEventListener('change', function(e) {
    musicVolume = parseFloat(volumeControl.value);
    localStorage.setItem('musicVolume', musicVolume);
  }, false);

  const recordToggle = document.querySelector('.js-o-record-toggle');
  const recordReset = document.querySelector('.js-o-record-reset');
  const recordSave = document.querySelector('.js-o-record-save');
  const recordPlayToggle = document.querySelector('.js-o-record-play-toggle');
  const recordLivePlayToggle = document.querySelector('#recording-live-playing');

  recordToggle.addEventListener('click', function(e) {
    if (recording) {
      record(ACTION_STOP_RECORDING);
      recordToggle.innerHTML = 'Start';
      recording = false;
    } else {
      recording = true;
      playback = [];
      recordToggle.innerHTML = '(Click to stop)';
      record(ACTION_START_RECORDING, [currentOctave]);
    }
  }, false);

  recordReset.addEventListener('click', function(e) {
    record(ACTION_STOP_RECORDING);
    recordToggle.innerHTML = 'Start';
    recording = false;
    playback = [];
  }, false);

  recordSave.addEventListener('click', function(e) {
    if (recording) {
      record(ACTION_STOP_RECORDING);
      recordToggle.innerHTML = 'Start';
      recording = false;
    }

    if (playback.length > 0) {
      recordSave.innerHTML = 'Saving…';
      db.collection('musics').add({ p: playback }).then(function(docRef) {
        window.location.hash = docRef.id;
        recordSave.innerHTML = 'Saved in URL!';
        setTimeout(function() {
          recordSave.innerHTML = 'Save';
        }, 5 * 1000);
      }).catch(function(error) {
        recordSave.innerHTML = 'Save';
        throw new error;
      });
    } else {
      //
    }
  }, false);

  var playSetTimeoutIds = [];
  var playing = false;

  recordPlayToggle.addEventListener('click', async function(e) {
    if (playing) {
      playSetTimeoutIds.forEach(clearTimeout);
      playSetTimeoutIds = [];
      recordPlayToggle.innerHTML = 'Play';
      playing = false;
    } else {
      playing = true;
      recordPlayToggle.innerHTML = 'Stop';

      let music;

      try {
        // @todo 2018-01-19 Add memoization (cache)
        music = await db.collection('musics').doc(window.location.hash.substring(1)).get().then(function(doc) {
          if (doc.exists) {
            return doc.data().p;
          }

          throw new Error("Document couldn't be found.");
        }).catch(function(error) {
          throw new Error(error);
        });
      } catch (e) {
        console.error(e);
        recordPlayToggle.innerHTML = 'Play';
        playing = false;
        return;
      }

      music.forEach(function (tick) {
        const [offset, action, payload] = [tick.o, tick.a, tick.p];

        // We use curly braces to scope the variables inside each case.
        switch (action) {
          case ACTION_PLAY_NOTE: {
            playSetTimeoutIds.push(setTimeout(function () {
              if (shouldLivePlay()) {
                return;
              }

              const [note, octave] = payload;
              playNote(note, octave);
            }, offset));
            break;
          }

          case ACTION_CHANGE_OCTAVE: {
            playSetTimeoutIds.push(setTimeout(function () {
              if ( ! shouldLivePlay()) {
                return;
              }

              handleOctaveChange(payload[0]);
            }, offset));
            break;
          }

          case ACTION_ON_SKILL_ACTIVATION: {
            playSetTimeoutIds.push(setTimeout(function () {
              if ( ! shouldLivePlay()) {
                return;
              }

              const [note, octave] = payload;

              const skill = Object.keys(skillToNoteOctave).find(skill => skillToNoteOctave[skill][octave] === note);
              onSkillActivation(skill, octave);
            }, offset));
            break;
          }

          case ACTION_ON_SKILL_DEACTIVATION: {
            playSetTimeoutIds.push(setTimeout(function () {
              if ( ! shouldLivePlay()) {
                return;
              }

              const [note, octave] = payload;

              const skill = Object.keys(skillToNoteOctave).find(skill => skillToNoteOctave[skill][octave] === note);
              onSkillDeactivation(skill, octave);
            }, offset));
            break;
          }

          case ACTION_START_RECORDING: {
            playSetTimeoutIds.push(setTimeout(function () {
              if ( ! shouldLivePlay()) {
                return;
              }

              handleOctaveChange(payload[0]);
            }, offset));
            break;
          }

          case ACTION_STOP_RECORDING: {
            playSetTimeoutIds.push(setTimeout(function () {
              playSetTimeoutIds.forEach(clearTimeout);
              playSetTimeoutIds = [];
              recordPlayToggle.innerHTML = 'Play';
              playing = false;
            }, offset));
            break;
          }

          default: {
            console.warn('Action [%s] not recognized.', action);
          }
        }
      });
    }
  }, false);

  recordLivePlayToggle.addEventListener('change', function() {
    if (recordLivePlayToggle.checked === false) {
      Object.keys(skillToKeyCode).forEach(skill => onSkillDeactivation(skill, currentOctave));
    }
  }, false);
})();
