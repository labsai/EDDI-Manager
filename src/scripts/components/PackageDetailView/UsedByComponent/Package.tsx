import * as React from 'react';
import { compose, pure, setDisplayName } from 'recompose';
import { IPackage } from '../../utils/AxiosFunctions';
import { connect } from 'react-redux';
import NameAndVersion from './NameAndVersion';
import { packageSelector } from '../../../selectors/PackageSelectors';
import { useNavigate } from 'react-router';
import { PACKAGE_VIEW } from '../../../constants/paths';

interface IPublicProps {
  packageResource: string;
  isSmallName: boolean;
  usedByOlderVersion?: boolean;
}

interface IPrivateProps extends IPublicProps {
  packagePayload: IPackage;
  isLoading: boolean;
  error: Error;
}

const Package = ({
  packagePayload,
  usedByOlderVersion,
  isSmallName,
}: IPrivateProps) => {
  const navigate = useNavigate();
  return (
    <NameAndVersion
      descriptor={packagePayload}
      usedByOlderVersion={usedByOlderVersion}
      isSmallName={isSmallName}
      onClick={() =>
        navigate(`${PACKAGE_VIEW.replace(':id', packagePayload.id)}/`)
      }
    />
  );
};

const ComposedPackage: React.ComponentClass<IPublicProps> = compose<
  IPrivateProps,
  IPublicProps
>(
  pure,
  connect(packageSelector),
  setDisplayName('Package'),
)(Package);

export default ComposedPackage;
