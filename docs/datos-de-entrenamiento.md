# Datos de entrenamiento del modelo de baches

## Principio de diseño: el modelo sugiere, la persona decide

El análisis automático es una **sugerencia**, nunca una decisión final.

- Quien reporta puede corregir la clasificación con los botones del bot (`Es correcto` / `Hay un error`) y elegir la categoría a mano.
- Si el modelo no está seguro, el reporte queda como `pendiente` para clasificación manual (no se fuerza una categoría).
- La persona define el **tamaño** del bache; el modelo no lo estima.
- Cada corrección humana pasa a ser una etiqueta de entrenamiento (vista `v_muestras_entrenamiento`), así el modelo mejora con el uso.
- Al integrar un modelo nuevo se usará un umbral de confianza conservador y se probará primero en modo sombra (corre y registra, sin decidir).

## Conjunto inicial: bache / no bache

Se construyó a partir de **RDD2022** para arrancar antes de tener suficientes fotos propias.

| Dato | Valor |
|---|---|
| Fuente | RDD2022, *The multi-national Road Damage Dataset released through CRDDC'2022* |
| Referencia | DOI `10.6084/m9.figshare.21431547.v1` · arXiv `2209.08538` |
| Licencia | CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/): se debe citar a los autores |
| Países usados | India, Japón, Chequia, China (moto) y Estados Unidos |
| Excluidos | Noruega (clima y calles poco comparables, 80 % del peso) y China (dron, perspectiva aérea) |
| Clase `bache` | Imágenes con alguna anotación `D40` (bache) |
| Clase `no_bache` | Imágenes sin `D40`: calles sin daño y calles con otros daños (grietas), como negativos difíciles. Hasta 2 negativos por cada positivo, por país |
| Separación | 85 % entrenamiento / 15 % validación por bloques de fotos consecutivas (reduce fugas entre fotogramas casi idénticos) |
| Tamaño final | 3,354 bache + 6,708 no bache = 10,062 imágenes (en la laptop del responsable, fuera del repositorio) |

El script de armado y el manifiesto (`manifest.csv`, con la ruta original de cada imagen) permiten reproducirlo.

## Límites conocidos

- Las fotos son de otros países y de cámaras en vehículos: se parecen poco a las que toma una persona con el teléfono en Querétaro.
- No existe la clase `otro` (basura, objetos, fotos sin relación con una calle). Sin ella, el modelo tendería a responder "bache" o "calle" a todo.
- Por eso este conjunto es solo el arranque: el modelo se afinará con los reportes reales validados o corregidos por personas.
