# Finger Frame
Finger Frame é um pequeno projeto capaz de detectar as coordenadas dos dedos na câmera, usando um modelo pronto de IA, e aplicar efeitos como escala cinza ou contorno da câmera.

## Tecnologias Envolvidas
As tecnologias usadas foram o *TensorFlowJS* e *WebGL*. Foi usado um modelo pronto do *TensorFlow* para detectar as coordenadas dos polegares e indicador na câmera, e após feito isso, desenhado um quadrilátero em volta e aplicado um filtro na parte de dentro desse polígono usando *WebGL* pela sua performance.

## Desenvolvimento
Inicialmente, esse projeto foi desenvolvido sem a ajuda de LLM, onde foi completado toda a detecção de coordenadas dos dedos usando o modelo do *TensorFlow*. Após isso, foi usado o *Copilot CLI* para desenvolver o *user interface* da página e os filtros de câmera usando *shaders*.
