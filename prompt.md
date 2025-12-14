I want you to design and implement a feature called garden. Garden should be a new section in 
the sidebar. The general idea is that:
- Petals are occurrences of a word in a translation. In the translation breakdown in chat, a user 
  should be able to select a word to save as a petal. Adding a word from a breakdown to petals should 
  have a reference to the conversation, the translation, and the user input that the translation came 
  from. We need to be able to retrieve these performantly.
- Flowers are petals grouped by the word. The idea is that a single word may have occurrences in multiple 
  example contexts, and that we want to be able to study a word by reflecting on all the petals of that 
  word we have collected from real encounters. This means we will need to be able to group petals by word 
  performantly.

The Garden page should basically list flowers filtered by whatever language is currently selected.
Clicking on a flower should allow you to inspect the original context of where that word was found, with 
the idea being this will help the user study.

