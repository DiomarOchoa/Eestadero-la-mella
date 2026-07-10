const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍻 Estadero La Mella API corriendo en puerto ${PORT}`);
});
