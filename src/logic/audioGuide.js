/**
 * 레지스탕스 아발론 - 밤 단계 음성/스크립트 가이드 컨트롤러
 */

export class AudioGuideController {
  constructor() {
    this.speechSynth = window.speechSynthesis || null;
    this.isMuted = false;
    this.currentStepIndex = 0;
    this.isPlaying = false;
    this.onStepChangeCallback = null;
    this.onCompleteCallback = null;
    this.timer = null;
  }

  generateNightScripts(selectedRoleIds = {}) {
    const scripts = [];

    // Step 1: 시작
    scripts.push({
      text: '모두 눈을 감고, 주먹을 앞으로 내밀어 주세요.',
      delay: 5000
    });

    // Step 2: 악의 세력 상호 확인 (오베론 제외)
    scripts.push({
      text: '오베론을 제외한 모드레드의 하수인들은 눈을 뜨고 서로의 정체를 확인해 주세요.',
      delay: 6000
    });
    scripts.push({
      text: '악의 세력은 모두 눈을 감아주세요.',
      delay: 4000
    });

    // Step 3: 멀린이 악 확인 (모드레드 제외)
    if (selectedRoleIds.MODRED) {
      scripts.push({
        text: '모드레드를 제외한 모든 악의 세력은 엄지를 위로 올려주세요.',
        delay: 4000
      });
    } else {
      scripts.push({
        text: '모든 악의 세력은 엄지를 위로 올려주세요.',
        delay: 4000
      });
    }

    scripts.push({
      text: '멀린은 눈을 뜨고 악의 무리가 누구인지 확인해 주세요.',
      delay: 6000
    });

    scripts.push({
      text: '엄지를 내리고, 멀린은 눈을 감아주세요.',
      delay: 4000
    });

    // Step 4: 퍼시벌이 멀린/모르가나 확인 (퍼시벌 존재 시)
    if (selectedRoleIds.PERCIVAL) {
      if (selectedRoleIds.MORGANA) {
        scripts.push({
          text: '멀린과 모르가나는 엄지를 위로 올려주세요.',
          delay: 4000
        });
      } else {
        scripts.push({
          text: '멀린은 엄지를 위로 올려주세요.',
          delay: 4000
        });
      }

      scripts.push({
        text: '퍼시벌은 눈을 뜨고 멀린의 정체를 확인해 주세요.',
        delay: 6000
      });

      scripts.push({
        text: '엄지를 내리고, 퍼시벌은 눈을 감아주세요.',
        delay: 4000
      });
    }

    // Step 5: 마무리
    scripts.push({
      text: '모두 눈을 떠주세요. 아발론의 운명을 건 원정이 시작됩니다!',
      delay: 4000
    });

    return scripts;
  }

  speak(text) {
    if (this.isMuted || !this.speechSynth) return;
    
    // 이전 음성 취소
    this.speechSynth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.9; // 약간 천천히 진중하게
    utterance.pitch = 0.9;
    
    this.speechSynth.speak(utterance);
  }

  startScriptSequence(scripts, onStepChange, onComplete) {
    this.stop();

    this.scripts = scripts;
    this.currentStepIndex = 0;
    this.isPlaying = true;
    this.onStepChangeCallback = onStepChange;
    this.onCompleteCallback = onComplete;

    this.processStep();
  }

  processStep() {
    if (!this.isPlaying) return;

    if (this.currentStepIndex >= this.scripts.length) {
      this.isPlaying = false;
      if (this.onCompleteCallback) this.onCompleteCallback();
      return;
    }

    const currentScript = this.scripts[this.currentStepIndex];
    
    if (this.onStepChangeCallback) {
      this.onStepChangeCallback(this.currentStepIndex, currentScript);
    }

    this.speak(currentScript.text);

    this.timer = setTimeout(() => {
      this.currentStepIndex++;
      this.processStep();
    }, currentScript.delay);
  }

  nextStepManually() {
    if (this.timer) clearTimeout(this.timer);
    if (this.speechSynth) this.speechSynth.cancel();

    this.currentStepIndex++;
    if (this.currentStepIndex < this.scripts.length) {
      this.processStep();
    } else {
      this.isPlaying = false;
      if (this.onCompleteCallback) this.onCompleteCallback();
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.speechSynth) this.speechSynth.cancel();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.speechSynth) {
      this.speechSynth.cancel();
    }
    return this.isMuted;
  }
}
