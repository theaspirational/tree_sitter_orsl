

npm install 

# In your shell profile script , or in your shell 
export PATH=$PATH:./node_modules/.bin

# After making changes to the grammar.js file
tree-sitter generate

# To parse a test file
tree-sitter parse test.orsl

# You can also prevent the syntax trees from being printed using the --quiet flag. Additionally, the --stat flag prints out aggregated parse success/failure information for all processed files
tree-sitter parse '*.orsl' --quiet --stat