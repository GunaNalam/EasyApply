// Service worker: opens the side panel from the toolbar icon and handles the keyboard shortcut.

import { FILL_MESSAGE } from '../shared/messages';

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'autofill') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) chrome.tabs.sendMessage(tab.id, { type: FILL_MESSAGE }).catch(() => undefined);
});
