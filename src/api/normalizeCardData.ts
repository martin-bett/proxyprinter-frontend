interface CardIcon {
    link: string;
    lang: string;
  }
  
  interface CardStyle {
    set: string;
    number: string;
    icons: CardIcon[];
  }
  
  interface NormalizedCard {
    name: string;
    cardStyles: CardStyle[];
  }
  
  function normalizeCardData(apiResults: any[]): NormalizedCard {
    const normalizedCard: NormalizedCard = {
      name: apiResults[0]?.name || '',
      cardStyles: []
    };
  
    apiResults.forEach(result => {
      const cardIcon: CardIcon = {
        link: result.imageUrl,
        lang: result.languageCode
      };
  
      const existingStyle = normalizedCard.cardStyles.find(
        style => style.set === result.set && style.number === result.setNumber
      );
  
      if (existingStyle) {
        existingStyle.icons.push(cardIcon);
      } else {
        normalizedCard.cardStyles.push({
          set: result.set,
          number: result.setNumber,
          icons: [cardIcon]
        });
      }
    });
  
    return normalizedCard;
  }