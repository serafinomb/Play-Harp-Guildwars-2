'use strict';

(function() {
  var keyCodeToSkill = {
    '49': '1',
    '50': '2',
    '51': '3',
    '52': '4',
    '53': '5',
    '54': '6',
    '55': '7',
    '56': '8',

    '57': '9',
    '48': '0',
    '67': '9', // Personal preference C
    '86': '0', // Personal preference V
  };

  var skillToKeyCode = {
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

  var keyCodeToNoteOctave = {
    '49': ['C3', 'C4', 'C5'],
    '50': ['D3', 'D4', 'D5'],
    '51': ['E3', 'E4', 'E5'],
    '52': ['F3', 'F4', 'F5'],
    '53': ['G3', 'G4', 'G5'],
    '54': ['A3', 'A4', 'A5'],
    '55': ['B3', 'B4', 'B5'],
    '56': ['C4', 'C5', 'C6'],

    '57': ['-1', '-1', '-1'],
    '48': ['+1', '+1', '+1'],
    '67': ['-1', '-1', '-1'],
    '86': ['+1', '+1', '+1'],
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
        // not only once "onload". We therefore check whether we've or not
        // already laoded all the needed audio files.
        audio.addEventListener('canplaythrough', function(note) {
          if (loadedCount >= toLoadCount * queueLength) {
            return
          };

          loadedCount++;
          cb(loadedCount, toLoadCount * queueLength);
        }.bind(null, note), false);

        sounds[note].push(audio);
      }
    }
  }

  preloadSounds(sounds, function(loaded, total) {
    var remaining = total - loaded;

    if (remaining == 0) {
      didLoad = true;
      var loadingScreen = document.getElementById('loadingScreen');
      loadingScreen.classList.add('fadeOut');
      setTimeout(function() {
        loadingScreen.remove();
      }, 1500);
    }
  });

  var didLoad = false;
  var activeNotes = {};
  var defaultOctave = 1;
  var currentOctave = 1;

  function addActiveStatus(element) {
    element && element.classList.add('is-active');
  }

  function removeActiveStatus(element) {
    element && element.classList.remove('is-active');
  }

  function handleOctaveChange(octave) {
    var skillBar = document.getElementById('skill-bar');
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
  }

  handleOctaveChange(currentOctave);

  function loadAudio(note) {
    return new Audio('audio/' + note + '.mp3');
  }

  function playAudio(audio) {
    audio.play();
    audio.addEventListener('ended', function() {
      audio.currentTime = 0;
    });
  }

  function playNote(note) {
    var preloaded = sounds[note];

    for (var i = 0; i < preloaded.length; i++) {
      if ( ! ( ! preloaded[i].paused || preloaded[i].currentTime)) {
        playAudio(preloaded[i]);
        return;
      }
    }

    var audio = loadAudio(note);
    playAudio(audio);
    sounds[note].push(audio);
  }

  function onSkillActivation(skill) {
    if ( ! didLoad) {
      return;
    }

    var which = skillToKeyCode[skill];

    if (activeNotes[which]) {
      return;
    }

    activeNotes[which] = +new Date();

    if ( ! (keyCodeToNoteOctave[which] && keyCodeToNoteOctave[which][currentOctave])) {
      return;
    }

    var note = keyCodeToNoteOctave[which][currentOctave];

    addActiveStatus(document.getElementById('skill-' + keyCodeToSkill[which]));

    if (note == '-1') {
      currentOctave = Math.max(0, currentOctave - 1);
      handleOctaveChange(currentOctave);
      return;
    }

    if (note == '+1') {
      currentOctave = Math.min(2, currentOctave + 1);
      handleOctaveChange(currentOctave);
      return;
    }

    playNote(note);
  };

  function onSkillDeactivation(skill) {
    if ( ! didLoad) {
      return;
    }

    removeActiveStatus(document.getElementById('skill-' + skill));
    delete activeNotes[skillToKeyCode[skill]];
  }

  document.addEventListener('keydown', function(e) {
    onSkillActivation(keyCodeToSkill[e.which]);
  }, false);

  document.addEventListener('keyup', function(e) {
    onSkillDeactivation(keyCodeToSkill[e.which]);
  }, false);

  document.addEventListener('mousewheel', function(e) {
    e.preventDefault();
  }, false);

  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  }, false);

  var skills = document.querySelectorAll('.js-skill');

  for (var i = 0; i < skills.length; i++) {
    skills[i].addEventListener('mousedown', function(e) {
      if (e.which !== 1) {
        return;
      }

      var skill = e.currentTarget.getAttribute('data-skill-id');
      onSkillActivation(skill);
    }, false);

    skills[i].addEventListener('mouseup', function(e) {
      if (e.which !== 1) {
        return;
      }

      var skill = e.currentTarget.getAttribute('data-skill-id');
      onSkillDeactivation(skill);
    }, false);
  }
})();
