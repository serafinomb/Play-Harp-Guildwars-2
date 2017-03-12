'use strict';

(function() {
  var database = firebase.database();

  var queue = [];

  database.ref(channel).on('child_added', function(snapshot) {
    queue.push(snapshot.val());
  });

  var intervalId = setInterval(processQueue, 50);

  var prevTime = 0;
  var prevTimeout = 0;

  function processQueue() {
    var picks = queue.splice(-5);

    if (picks.length == 0) {
      return;
    }

    if ( ! prevTime) {
      prevTime = picks[0].time;
    }

    for (var i = 0; i < picks.length; i++) {
      var pick = picks[i];

      var timeout = prevTimeout + (pick.time - prevTime);

      console.log(timeout, prevTimeout, pick.time - prevTime);

      setTimeout(function() {
        if (pick.skillDown) {
          playNote(skillToNoteOctave[pick.skill][pick.octave]);
        }
      }, timeout);

      prevTime = pick.time;
      prevTimeout = timeout;
    }
  };

  processQueue();
})();
