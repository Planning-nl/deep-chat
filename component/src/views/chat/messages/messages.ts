import {TextToSpeech} from './textToSpeech/textToSpeech';
import {AiAssistant} from '../../../aiAssistant';
import {Avatars} from '../../../types/avatar';
import {Names} from '../../../types/names';
import {Avatar} from './avatar';
import {Name} from './name';
import {
  CustomMessageStyles,
  CustomMessageStyle,
  MessageContent,
  ErrorMessages,
  OnNewMessage,
} from '../../../types/messages';

export type AddNewMessage = Messages['addNewMessage'];

interface MessageElements {
  outerContainer: HTMLElement;
  innerContainer: HTMLElement;
  textElement: HTMLElement;
}

export class Messages {
  elementRef: HTMLElement;
  private readonly _messageElementRefs: MessageElements[] = [];

  private readonly _messageStyles?: CustomMessageStyles;
  private readonly _avatars?: Avatars;
  private readonly _names?: Names;
  private readonly _customErrorMessage?: ErrorMessages;
  private readonly _onNewMessage?: OnNewMessage;
  private readonly _dispatchEvent: (event: Event) => void;
  private readonly _speechOutput?: boolean;
  private readonly _displayLoadingMessage?: boolean;
  messages: MessageContent[] = [];

  constructor(aiAssistant: AiAssistant) {
    this.elementRef = Messages.createContainerElement();
    this._messageStyles = aiAssistant.messageStyles;
    this._avatars = aiAssistant.avatars;
    this._names = aiAssistant.names;
    this._customErrorMessage = aiAssistant.errorMessage;
    this._speechOutput = aiAssistant.speechOutput;
    this._dispatchEvent = aiAssistant.dispatchEvent.bind(aiAssistant);
    this._onNewMessage = aiAssistant.onNewMessage;
    this._displayLoadingMessage = aiAssistant.displayLoadingMessage ?? true;
    if (aiAssistant.initMessages) this.populateInitialMessages(aiAssistant.initMessages);
  }

  private static createContainerElement() {
    const container = document.createElement('div');
    container.id = 'messages';
    return container;
  }

  private populateInitialMessages(initMessages: MessageContent[]) {
    initMessages.forEach(({role, content}) => {
      this.addNewMessage(content, role === 'assistant', true, true);
    });
  }

  // prettier-ignore
  private static applyCustomStylesToElements(outerC: HTMLElement, innerC: HTMLElement,
      text: HTMLElement, style: CustomMessageStyle) {
    Object.assign(outerC.style, style.outerContainer);
    Object.assign(innerC.style, style.innerContainer);
    Object.assign(text.style, style.text);
  }

  // prettier-ignore
  private static applyCustomStyles(outerC: HTMLElement, innerC: HTMLElement,
      text: HTMLElement, styles: CustomMessageStyles, isAI: boolean) {
    if (styles.default) Messages.applyCustomStylesToElements(outerC, innerC, text, styles.default);
    if (isAI) {
      if (styles.ai) Messages.applyCustomStylesToElements(outerC, innerC, text, styles.ai);
    } else if (styles.user) {
      Messages.applyCustomStylesToElements(outerC, innerC, text, styles.user);
    }
  }

  private addInnerContainerElements(textElement: HTMLElement, text: string, isAI: boolean) {
    textElement.classList.add('message-text', isAI ? 'ai-message-text' : 'user-message-text');
    textElement.innerHTML = text;
    if (this._avatars) Avatar.add(textElement, isAI, this._avatars);
    if (this._names) Name.add(textElement, isAI, this._names);
    return {textElement};
  }

  private static createMessageContent(text: string, isAI: boolean) {
    return {role: isAI ? 'assistant' : 'user', content: text} as const;
  }

  private static createBaseElements(): MessageElements {
    const outerContainer = document.createElement('div');
    const innerContainer = document.createElement('div');
    innerContainer.classList.add('inner-message-container');
    outerContainer.appendChild(innerContainer);
    const textElement = document.createElement('div');
    textElement.classList.add('message-text');
    innerContainer.appendChild(textElement);
    return {outerContainer, innerContainer, textElement};
  }

  private createMessageElements(text: string, isAI: boolean, addToMesages = true) {
    const messageElements = Messages.createBaseElements();
    const {outerContainer, innerContainer, textElement} = messageElements;
    outerContainer.appendChild(innerContainer);
    this.addInnerContainerElements(textElement, text, isAI);
    if (this._messageStyles) {
      Messages.applyCustomStyles(outerContainer, innerContainer, textElement, this._messageStyles, isAI);
    }
    this._messageElementRefs.push(messageElements);
    if (addToMesages) this.messages.push(Messages.createMessageContent(text, isAI));
    return messageElements;
  }

  private sendClientUpdate(text: string, isAI: boolean, isInitial = false) {
    const message = Messages.createMessageContent(text, isAI);
    this._onNewMessage?.(message, isInitial);
    this._dispatchEvent(new CustomEvent('new-message', {detail: {message, isInitial}}));
  }

  // prettier-ignore
  private removeMessageOnError() {
    const lastTextElement = this._messageElementRefs[this._messageElementRefs.length - 1]?.textElement;
    if ((lastTextElement?.classList.contains('streamed-message') && lastTextElement.textContent === '') ||
        lastTextElement?.classList.contains('loading-message-text')) {
      lastTextElement.remove();
      this._messageElementRefs.pop();
    }
  }

  // prettier-ignore
  public addNewErrorMessage(type: keyof Omit<ErrorMessages, 'default'>, message?: string) {
    this.removeMessageOnError();
    const {outerContainer, innerContainer, textElement} = Messages.createBaseElements();
    textElement.classList.add('error-message-text');
    const text = this._customErrorMessage?.[type]?.text || this._customErrorMessage?.default?.text ||
      message || 'Error, please try again.';
    textElement.innerHTML = text;
    const styles = this._customErrorMessage?.[type]?.styles || this._customErrorMessage?.default?.styles;
    if (styles) Messages.applyCustomStylesToElements(outerContainer, innerContainer, textElement, styles);
    this.elementRef.appendChild(outerContainer);
    this.elementRef.scrollTop = this.elementRef.scrollHeight;
    if (this._speechOutput && window.SpeechSynthesisUtterance) TextToSpeech.speak(text);
  }

  private createNewMessageElement(text: string, isAI: boolean) {
    const lastMessageElements = this._messageElementRefs[this._messageElementRefs.length - 1];
    if (isAI && lastMessageElements?.textElement.classList.contains('loading-message-text')) {
      lastMessageElements.textElement.classList.remove('loading-message-text');
      lastMessageElements.textElement.innerHTML = text;
      return lastMessageElements;
    }
    const messageElements = this.createMessageElements(text, isAI);
    this.elementRef.appendChild(messageElements.outerContainer);
    return messageElements;
  }

  public addNewMessage(text: string, isAI: boolean, update: boolean, isInitial = false) {
    const messageElements = this.createNewMessageElement(text, isAI);
    this.elementRef.scrollTop = this.elementRef.scrollHeight;
    if (this._speechOutput && isAI) TextToSpeech.speak(text);
    if (update) this.sendClientUpdate(text, isAI, isInitial);
    return messageElements;
  }

  public addLoadingMessage() {
    if (!this._displayLoadingMessage) return;
    const {outerContainer, textElement} = this.createMessageElements('', true, false);
    textElement.classList.add('loading-message-text');
    const dotsElement = document.createElement('div');
    dotsElement.classList.add('dots-flashing');
    textElement.appendChild(dotsElement);
    this.elementRef.appendChild(outerContainer);
    this.elementRef.scrollTop = this.elementRef.scrollHeight;
  }

  public addNewStreamedMessage() {
    const {textElement} = this.addNewMessage('', true, false);
    textElement.classList.add('streamed-message');
    return textElement;
  }

  public static updateStreamedMessage(text: string, textElement: HTMLElement) {
    const textNode = document.createTextNode(text);
    textElement.appendChild(textNode);
  }

  public finaliseStreamedMessage(text: string) {
    this.sendClientUpdate(text, true);
    if (this._speechOutput && window.SpeechSynthesisUtterance) TextToSpeech.speak(text);
  }
}
