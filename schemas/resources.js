const { model, Schema } = require('mongoose');

module.exports = model('resources',
  new Schema({
    title: String,
    link: String,
    tag: String,
    description: String,
    category: String
  })
)
